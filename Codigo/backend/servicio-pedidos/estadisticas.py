"""Cálculos del dashboard del administrador."""
from collections import defaultdict
from datetime import datetime, timedelta

from models import CATEGORIA_DISENO, Pedido, utc_now

NOMBRES_MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']


def _inicio_mes(anio, mes):
    # Permite meses fuera de 1..12 (por ejemplo, mes 0 = diciembre del año anterior)
    anio += (mes - 1) // 12
    mes = (mes - 1) % 12 + 1
    return datetime(anio, mes, 1)


def calcular(meses=6):
    """meses debe ser al menos 2 (el mes actual y el anterior)."""
    ahora = utc_now()
    inicios = [_inicio_mes(ahora.year, ahora.month - k) for k in range(meses - 1, -1, -1)]
    desde = inicios[0]

    pedidos = Pedido.query.filter(Pedido.fecha_pedido >= desde).all()
    validos = [p for p in pedidos if p.estado.nombre_estado != 'cancelado']

    por_mes = {inicio: {'pedidos': 0, 'ventas': 0} for inicio in inicios}
    categorias = defaultdict(lambda: {'unidades': 0, 'ventas': 0})
    productos = defaultdict(lambda: {'unidades': 0, 'ventas': 0})

    for pedido in validos:
        mes = _inicio_mes(pedido.fecha_pedido.year, pedido.fecha_pedido.month)
        por_mes[mes]['pedidos'] += 1
        por_mes[mes]['ventas'] += pedido.total
        for item in pedido.items:
            categoria = item['categoria'] or 'Sin categoría'
            nombre = CATEGORIA_DISENO if item['tipo'] == 'personalizado' else item['nombre']
            for acumulado, clave in ((categorias, categoria), (productos, nombre)):
                acumulado[clave]['unidades'] += item['cantidad']
                acumulado[clave]['ventas'] += item['subtotal']

    serie = [
        {'mes': inicio.strftime('%Y-%m'), 'etiqueta': f'{NOMBRES_MES[inicio.month - 1]} {inicio.year}', **valores}
        for inicio, valores in por_mes.items()
    ]
    actual, anterior = serie[-1], serie[-2] if len(serie) > 1 else {'pedidos': 0, 'ventas': 0}

    def ranking(datos, limite=None):
        filas = sorted(({'nombre': k, **v} for k, v in datos.items()), key=lambda f: f['ventas'], reverse=True)
        return filas[:limite] if limite else filas

    por_estado = defaultdict(int)
    for pedido in Pedido.query.all():
        por_estado[pedido.estado.nombre_estado] += 1

    # Comparación justa: del día 1 hasta hoy, contra los mismos días del mes anterior
    inicio_actual = inicios[-1]
    inicio_anterior = inicios[-2]
    transcurrido = ahora - inicio_actual

    def periodo(desde_fecha, hasta_fecha):
        dentro = [p for p in validos if desde_fecha <= p.fecha_pedido < hasta_fecha]
        return {'pedidos': len(dentro), 'ventas': sum(p.total for p in dentro)}

    total_ventas = sum(p.total for p in validos)
    return {
        'periodo_meses': meses,
        'mes_actual': {k: actual[k] for k in ('etiqueta', 'pedidos', 'ventas')},
        'mes_anterior': {k: anterior.get(k) for k in ('etiqueta', 'pedidos', 'ventas')},
        'comparacion': {
            'dias': transcurrido.days + 1,
            'actual': periodo(inicio_actual, ahora + timedelta(seconds=1)),
            'anterior': periodo(inicio_anterior, min(inicio_anterior + transcurrido, inicio_actual)),
        },
        'ticket_promedio': round(total_ventas / len(validos)) if validos else 0,
        'por_mes': serie,
        'por_categoria': ranking(categorias),
        'top_productos': ranking(productos, 5),
        'por_estado': dict(por_estado),
    }
