"""Cotización propia para la demostración. NO consulta ni reproduce tarifas de Blue Express."""
import os
import unicodedata


REGIONES = [
    ('arica_parinacota', 'Arica y Parinacota', 8500),
    ('tarapaca', 'Tarapacá', 8000),
    ('antofagasta', 'Antofagasta', 7500),
    ('atacama', 'Atacama', 6500),
    ('coquimbo', 'Coquimbo', 5500),
    ('valparaiso', 'Valparaíso', 4800),
    ('metropolitana', 'Metropolitana de Santiago', 3500),
    ('ohiggins', "Libertador General Bernardo O'Higgins", 4800),
    ('maule', 'Maule', 5200),
    ('nuble', 'Ñuble', 5500),
    ('biobio', 'Biobío', 5800),
    ('araucania', 'La Araucanía', 6500),
    ('los_rios', 'Los Ríos', 6800),
    ('los_lagos', 'Los Lagos', 7200),
    ('aysen', 'Aysén', 10000),
    ('magallanes', 'Magallanes y de la Antártica Chilena', 11500),
]
NOTA_SIMULACION = 'Valores simulados para presentación; no son tarifas oficiales de Blue Express.'
COMUNAS_ALEJADAS_RM = {
    'alhue', 'buin', 'calera de tango', 'colina', 'curacavi', 'el monte', 'isla de maipo',
    'lampa', 'maria pinto', 'melipilla', 'padre hurtado', 'paine', 'penaflor', 'pirque',
    'san jose de maipo', 'san pedro', 'talagante', 'tiltil', 'til til',
}


def normalizar(texto):
    return ''.join(c for c in unicodedata.normalize('NFKD', texto.lower().strip()) if not unicodedata.combining(c))


def transferencia_config():
    campos = {
        'titular': 'TRANSFERENCIA_TITULAR', 'rut': 'TRANSFERENCIA_RUT',
        'banco': 'TRANSFERENCIA_BANCO', 'tipo_cuenta': 'TRANSFERENCIA_TIPO_CUENTA',
        'numero_cuenta': 'TRANSFERENCIA_NUMERO_CUENTA', 'correo': 'TRANSFERENCIA_CORREO',
    }
    # Datos públicos de recepción de transferencias proporcionados por Change Future.
    valores = {'titular': 'Change Future', 'rut': '18.966.548-2', 'banco': 'Mercado Pago',
               'tipo_cuenta': 'Cuenta vista', 'numero_cuenta': '1026449772',
               'correo': 'changefuture.store@gmail.com'}
    datos = {clave: os.getenv(variable, valores[clave]).strip() for clave, variable in campos.items()}
    datos['correo'] = datos['correo'] or os.getenv('CF_ADMIN_EMAIL', 'changefuture.store@gmail.com')
    datos['configurada'] = all(datos[campo] for campo in campos)
    return datos


def opciones_checkout():
    return {
        'regiones': [{'codigo': codigo, 'nombre': nombre} for codigo, nombre, _ in REGIONES],
        'envio': {'origen': 'La Florida', 'simulado': True, 'nota': NOTA_SIMULACION},
        'transferencia': transferencia_config(),
        'comprobante': {'max_mb': 5, 'formatos': ['image/jpeg', 'image/png', 'image/webp']},
    }


def calcular_envio(metodo, entrega, unidades):
    """La talla por unidades es una simplificación explícita de esta simulación."""
    talla = 'S' if unidades <= 3 else 'M' if unidades <= 8 else 'L'
    if metodo == 'metro':
        return {'origen': 'La Florida', 'proveedor': 'Entrega en Metro', 'simulado': False,
                'region': 'metropolitana', 'region_nombre': 'Metropolitana de Santiago',
                'comuna': '', 'talla': talla, 'costo': 0,
                'nota': 'Entrega coordinada en Rojas Magallanes o Bellavista de La Florida.'}
    regiones = {codigo: (nombre, base) for codigo, nombre, base in REGIONES}
    region = entrega.get('region')
    if region not in regiones:
        raise ValueError('Elige una región válida para simular el despacho.')
    comuna = str(entrega.get('comuna') or '').strip()
    if not 2 <= len(comuna) <= 80:
        raise ValueError('Ingresa una comuna de entre 2 y 80 caracteres.')
    nombre, base = regiones[region]
    if region == 'metropolitana' and normalizar(comuna) in COMUNAS_ALEJADAS_RM:
        base += 1200
    costo = base + {'S': 0, 'M': 1500, 'L': 3500}[talla]
    return {'origen': 'La Florida', 'proveedor': 'Blue Express', 'simulado': True,
            'region': region, 'region_nombre': nombre, 'comuna': comuna,
            'talla': talla, 'costo': costo, 'nota': NOTA_SIMULACION,
            'criterio_talla': 'Estimación por unidades: S 1–3, M 4–8, L 9 o más. No usa peso ni dimensiones reales.'}
