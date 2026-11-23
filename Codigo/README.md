# Change Future: arquitectura de microservicios

Tienda de productos impresos en 3D. El frontend usa **React** y el backend está hecho con **Flask**, dividido en microservicios que siguen el diagrama de componentes y el de despliegue de la Fase 1.

```
Navegador
   │ HTTPS
   ▼
frontend (React + Vite)          :5173
   │ /api/...
   ▼
gateway (Flask)                  :5000   ← único punto de entrada
   ├──► servicio-usuarios        :5001   → usuarios_db
   ├──► servicio-catalogo        :5002   → catalogo_db
   ├──► servicio-pedidos         :5003   → pedidos_db
   │        ├──► servicio-catalogo        (precio real de los productos)
   │        └──► servicio-personalizacion (precio de los diseños confirmados)
   └──► servicio-personalizacion :5004   → personalizacion_db
            └──► servicio-procesamiento :5005  (interno: imagen → modelo 3D)
                                          (PostgreSQL)
```

## Estructura de carpetas

```
Codigo/
├── docker-compose.yml          # levanta todo con un comando
├── backend/
│   ├── db/init.sql             # crea una base de datos por servicio
│   ├── gateway/                # API Gateway: reenvía /api/<servicio>/... al servicio correcto
│   ├── servicio-usuarios/      # registro, login (JWT), perfil
│   ├── servicio-catalogo/      # categorías y productos (filtros, búsqueda, orden)
│   ├── servicio-pedidos/       # crea pedidos y valida precios con el catálogo
│   ├── servicio-personalizacion/  # "Crea desde cero": imagen, color, tamaño y propuesta 3D
│   └── servicio-procesamiento/    # convierte la imagen en un modelo 3D imprimible (STL)
├── frontend/
│   ├── public/assets/images/   # logo e imágenes
│   └── src/
│       ├── components/         # Header, Footer, ProductCard, ...
│       ├── context/            # estado global: sesión, carrito, avisos
│       ├── pages/              # una página por ruta
│       ├── services/api.js     # todas las llamadas al gateway
│       └── styles/style.css    # mismos estilos del prototipo
└── prototipo-html/             # versión HTML original, como referencia
```

Cada microservicio tiene la misma forma:

| Archivo            | Qué contiene                                    |
|--------------------|-------------------------------------------------|
| `app.py`           | crea la app Flask y define las rutas            |
| `models.py`        | tablas (SQLAlchemy) tomadas del modelo relacional |
| `requirements.txt` | dependencias de Python                          |
| `Dockerfile`       | imagen para desplegar el servicio               |

## Cómo ejecutarlo

### Opción A: Docker (recomendada)

```bash
cd Codigo
docker compose up --build
```

- Sitio: http://localhost:5173
- Estado de los servicios: http://localhost:5000/api/health

### Opción B: sin Docker (para desarrollar)

**En Windows, lo más fácil:** haz doble clic en `iniciar.bat`. La primera vez instala todo (se demora unos minutos) y luego abre una ventana por servicio y el navegador en http://localhost:5173. Para apagar, cierra esas ventanas. Necesitas tener instalados Python y Node.js.

Si prefieres hacerlo a mano:

Sin `DATABASE_URL`, cada servicio usa un archivo SQLite local, así que no necesitas instalar PostgreSQL.

```bash
# Una terminal por servicio (gateway, servicio-usuarios, servicio-catalogo, ...)
cd Codigo/backend/servicio-catalogo
python -m venv .venv
source .venv/bin/activate        # En Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

Puertos: gateway 5000, usuarios 5001, catálogo 5002, pedidos 5003, personalización 5004, procesamiento 5005.

```bash
# Frontend
cd Codigo/frontend
npm install
npm run dev
```

## Endpoints (a través del gateway)

| Método | Ruta                                   | Servicio        | Descripción |
|--------|----------------------------------------|-----------------|-------------|
| POST   | `/api/usuarios/registro`               | usuarios        | Crea una cuenta (nombre, apellido, RUT, correo, contraseña) |
| POST   | `/api/usuarios/login`                  | usuarios        | Inicia sesión y devuelve un token |
| GET    | `/api/usuarios/perfil`                 | usuarios        | Datos del cliente (requiere token) |
| PUT    | `/api/usuarios/perfil`                 | usuarios        | Modifica nombre, apellido y teléfono |
| PUT    | `/api/usuarios/perfil/contrasena`      | usuarios        | Cambia la contraseña (pide la actual) |
| POST   | `/api/usuarios/recuperar`              | usuarios        | Envía el enlace para restablecer la contraseña |
| POST   | `/api/usuarios/restablecer`            | usuarios        | Guarda la nueva contraseña con el enlace recibido |
| GET    | `/api/catalogo/categorias`             | catálogo        | Lista de categorías |
| GET    | `/api/catalogo/productos`              | catálogo        | `?categoria=`, `?q=`, `?orden=price-low\|price-high\|name`, `?destacados=true` |
| GET    | `/api/catalogo/productos/<id>`         | catálogo        | Ficha de producto |
| POST   | `/api/catalogo/productos`              | catálogo        | Crear producto, con imagen opcional (administrador, multipart) |
| PUT    | `/api/catalogo/productos/<id>`         | catálogo        | Modificar producto (administrador) |
| PATCH  | `/api/catalogo/productos/<id>/estado`  | catálogo        | Deshabilitar o habilitar: `{"activo": false}` (administrador) |
| GET    | `/api/catalogo/productos?incluir_inactivos=true` | catálogo | Todos los productos, también deshabilitados (administrador) |
| GET    | `/api/usuarios/clientes?q=`            | usuarios        | Clientes registrados; busca por nombre, correo, RUT o teléfono (administrador) |
| GET    | `/api/usuarios/clientes/<id>`          | usuarios        | Datos de un cliente (administrador) |
| POST   | `/api/pedidos/pedidos`                 | pedidos         | Confirma la compra (requiere sesión; valida contacto y entrega) |
| GET    | `/api/pedidos/pedidos`                 | pedidos         | Mis pedidos. Administrador: `?todos=true`, `&estado=`, `&q=` (N°, cliente o teléfono) |
| GET    | `/api/pedidos/pedidos/<id>`            | pedidos         | Detalle con productos, personalización, estado e historial |
| PATCH  | `/api/pedidos/pedidos/<id>/estado`     | pedidos         | Cambia el estado, con comentario opcional (administrador) |
| GET    | `/api/pedidos/estados`                 | pedidos         | Estados posibles en orden |
| GET    | `/api/pedidos/estadisticas?meses=6`    | pedidos         | Datos del dashboard (administrador) |
| GET    | `/api/personalizacion/opciones`        | personalización | Colores, tamaños y estilos disponibles |
| POST   | `/api/personalizacion/solicitudes`     | personalización | Sube la imagen (multipart) y genera la primera propuesta 3D |
| POST   | `/api/personalizacion/solicitudes/<codigo>/propuestas` | personalización | Genera otra propuesta (por ejemplo, con el otro estilo) |
| PATCH  | `/api/personalizacion/solicitudes/<codigo>` | personalización | Guarda el color y el tamaño elegidos |
| POST   | `/api/personalizacion/solicitudes/<codigo>/confirmar` | personalización | Confirma la configuración antes del carrito |
| GET    | `/api/personalizacion/solicitudes/<codigo>/modelo` | personalización | Descarga el modelo 3D (STL) |
| GET    | `/api/personalizacion/solicitudes?estado=` | personalización | Mis solicitudes; el administrador ve todas (sin borradores, salvo que filtre) |
| PATCH  | `/api/personalizacion/solicitudes/<codigo>/estado` | personalización | Cambia el estado y las observaciones (administrador) |
| GET    | `/api/personalizacion/referencias/<archivo>` | personalización | Imagen de referencia (solo administrador) |
| GET    | `/api/pedidos/pedidos/por-solicitud/<codigo>` | pedidos | Pedidos donde se compró un diseño (administrador) |

## Ideas clave de la arquitectura

- **API Gateway:** el frontend solo conoce `/api`. El gateway decide a qué servicio va cada petición, así los servicios pueden moverse o escalar sin cambiar el frontend.
- **Base de datos por servicio:** cada servicio es dueño de sus tablas. Por eso `pedido.id_usuario` no es una clave foránea real: el usuario vive en otra base de datos.
- **Comunicación entre servicios:** al crear un pedido, `servicio-pedidos` consulta a `servicio-catalogo` el precio de cada producto (y a `servicio-personalizacion` el de cada diseño), en vez de confiar en el precio que manda el navegador.
- **Autenticación con JWT:** `servicio-usuarios` firma el token y los demás servicios lo verifican con la misma clave (`JWT_SECRET`). Cámbiala en producción.

## Cuentas de usuario (EP01)

| Historia | Dónde está |
|----------|-----------|
| HU01.1 Registro | `/login` → pestaña "Crear cuenta". Pide nombre, apellido, RUT, correo, teléfono (opcional) y contraseña. Valida campos obligatorios, formato del correo, dígito verificador del RUT y que el correo y el RUT no estén registrados. |
| HU01.2 Inicio de sesión | `/login` → pestaña "Ingresar". Si los datos no coinciden, muestra "Correo o contraseña incorrectos". |
| HU01.3 Cerrar sesión | Botón "Cerrar sesión" en `/perfil`. Borra la sesión y vuelve a `/login`. Sin sesión, `/perfil` redirige a `/login`. |
| HU01.4 Datos personales | `/perfil`: muestra los datos y permite editar nombre, apellido y teléfono, y cambiar la contraseña. El correo y el RUT no se editan. |
| HU01.5 Recuperar contraseña | "¿Olvidaste tu contraseña?" en `/login` → `/recuperar`. Se envía un enlace (válido 30 minutos y de un solo uso) que abre `/restablecer`. |

Reglas: la contraseña debe tener al menos 8 caracteres, con letras y números. Las validaciones están en `frontend/src/services/validaciones.js` y se repiten en el backend, en `backend/servicio-usuarios/validaciones.py`.

**Correo de recuperación en desarrollo:** si no hay servidor de correo configurado, el enlace aparece en la ventana **"Servicio usuarios"** (o en `docker compose logs usuarios`). Cópialo y ábrelo en el navegador. Para enviar correos reales, define `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER` y `SMTP_PASSWORD`.

**Pruebas automáticas** del servicio de usuarios (cubren las 5 historias):

```bash
cd backend/servicio-usuarios
pip install pytest
python -m pytest
```

## Personalización con propuesta 3D (EP03)

Todo ocurre en **Crea desde cero** (`/crea-desde-cero`), en 4 pasos: tu idea → tu imagen → color y tamaño → confirmar.

| Historia | Cómo se cumple |
|----------|----------------|
| Cargar imagen | Se elige una imagen desde el dispositivo. Solo se aceptan JPG, PNG o WEBP de hasta 10 MB (se revisa en el navegador y en el servidor, incluyendo el contenido real del archivo). Si no cumple, se informa el motivo. La imagen queda guardada y asociada a la solicitud. |
| Generar propuesta | La imagen va al `servicio-procesamiento`, que genera un modelo 3D. Mientras tanto se muestra "Estamos generando tu propuesta 3D…". La propuesta aparece en un visor 3D que se puede girar y acercar. Si algo falla (imagen sin figura, servicio apagado), se informa el error y se puede reintentar. |
| Seleccionar color | Se muestran los 8 colores disponibles. El elegido queda marcado con ✓ y el modelo 3D cambia de color. |
| Seleccionar tamaño | Pequeño (5 cm), mediano (10 cm) y grande (15 cm), cada uno con su precio. El elegido queda marcado y el modelo cambia de tamaño sobre una grilla de 1 cm. |
| Visualizar personalización | El paso "Confirmar" muestra el proyecto, el estilo, el color, el tamaño, el precio y la propuesta 3D. El botón "Confirmar y agregar al carrito" lo agrega. El color y el tamaño se conservan en el carrito, en el pedido y en el mensaje de WhatsApp. |

**Dos estilos de propuesta** (sin servicios externos, solo Python con Pillow y NumPy):
- **Silueta:** separa la figura del fondo (usa la transparencia o el color del borde) y la extruye como una pieza plana de 4 mm. Ideal para llaveros, imanes y figuras recortadas. Funciona mejor con dibujos, logos o fotos con fondo liso.
- **Relieve:** las zonas claras quedan más altas que las oscuras (1,6 a 4,6 mm). Ideal para cuadros y placas con fotos.

El modelo se guarda como **STL**, el formato que usan las impresoras 3D, así que la propuesta aprobada se puede imprimir directamente. Los archivos quedan en `backend/servicio-personalizacion/uploads/` (`referencias/` para las imágenes y `propuestas/` para los STL).

**Pruebas automáticas:** `servicio-procesamiento/tests` revisa que los modelos sean piezas cerradas (imprimibles) y con las medidas correctas, y `servicio-personalizacion/tests` revisa los criterios de aceptación de las 5 historias.

## Carrito y compra (EP04)

| Historia | Cómo se cumple |
|----------|----------------|
| HU04.1 Agregar producto | Botón ＋ en el catálogo o "Agregar al carrito" en la ficha. Los diseños de "Crea desde cero" llegan con su estilo, color y tamaño. El total se recalcula solo. |
| HU04.2 Modificar cantidad | Botones − / ＋ o escribiendo la cantidad (1 a 99). Se actualizan el subtotal de la línea y el total. |
| HU04.3 Eliminar producto | Botón × en cada línea; el total se actualiza. |
| HU04.4 Revisar resumen | "Revisar mi pedido" muestra productos, cantidades, precios, personalización, datos de entrega y total. |
| HU04.5 Confirmar compra | Requiere sesión (para que el pedido quede en "Mis pedidos"). Valida nombre, teléfono y datos de entrega en el navegador y en el servidor. Al confirmar, el pedido se registra con los precios reales y se muestra la confirmación con su número y un botón para coordinar por WhatsApp. |

## Pedidos y administración (EP05)

| Historia | Dónde está |
|----------|-----------|
| HU05.1 Consultar historial | **Mis pedidos** (`/mis-pedidos`): número, fecha, estado y total. Solo se ven los pedidos del cliente que inició sesión. |
| HU05.2 Consultar detalle | "Ver detalle": productos, personalización, entrega, estado e historial de cambios. |
| HU05.3 Consultar estado | El detalle muestra el estado actual con una barra de avance (pendiente → confirmado → en producción → enviado → entregado). |
| HU05.4 Actualizar estado | **Administración → Pedidos recibidos → Gestionar**: el administrador elige el nuevo estado y puede dejar un comentario para el cliente. Queda en el historial y el cliente lo ve de inmediato. |
| HU05.5 Pedidos recibidos | `/admin/pedidos`: todos los pedidos, con filtro por estado y búsqueda por número, cliente o teléfono. |

**Dashboard** (`/admin`):
- Pedidos y ventas del mes en curso, comparados con **los mismos días del mes anterior** (comparar 4 días de este mes contra un mes completo siempre parecería una caída).
- Ticket promedio y pedidos por atender.
- Pedidos o ventas por mes (3, 6 o 12 meses), con el mes actual destacado.
- Ventas por categoría, productos más vendidos y pedidos por estado (cada estado abre la lista filtrada).
- Los pedidos cancelados no cuentan en las ventas. Cada gráfico tiene "Ver como tabla" con los valores exactos.

## Administración del catálogo, clientes y solicitudes (EP06)

| Historia | Dónde está |
|----------|-----------|
| HU06.1 Agregar productos | **Administración → Productos → ＋ Nuevo producto**. Pide nombre, categoría (si es nueva, se crea), precio, descripción, stock, material y personalización. Valida cada campo. La imagen (JPG, PNG o WEBP de hasta 5 MB) se ve antes de guardar. El producto aparece de inmediato en el catálogo. |
| HU06.2 Modificar productos | **Editar** en la lista de productos: el formulario viene con los datos actuales y los cambios se ven al tiro en el catálogo. |
| HU06.3 Deshabilitar productos | **Deshabilitar** en la lista (pide confirmación). El producto desaparece del catálogo, su ficha no se puede abrir y no se puede comprar: si ya estaba en un carrito, el carrito avisa y no deja confirmar. No se borra: los pedidos antiguos conservan su nombre y precio, y se puede volver a **habilitar**. |
| HU06.4 Consultar clientes | **Administración → Clientes**: nombre, RUT, correo, teléfono, fecha de registro, cantidad de pedidos y total comprado, con búsqueda. **Ver ficha** muestra sus pedidos, con acceso directo para gestionarlos. |
| HU06.5 Solicitudes de personalización | **Administración → Solicitudes**: filtro por estado (por revisar, en revisión, aprobada, en producción, completada, rechazada). Cada solicitud muestra la imagen de referencia, la propuesta 3D, las características (estilo, color, tamaño, medidas, precio), el cliente y los pedidos donde se compró. El administrador cambia el estado, deja observaciones y puede descargar el archivo STL para imprimir. |

Las imágenes de los productos se guardan en `backend/servicio-catalogo/uploads/productos/`.

## Herramientas (Windows)

Doble clic en **`herramientas.bat`** (después de haber ejecutado `iniciar.bat` una vez):

1. **Convertir una cuenta en administrador:** crea la cuenta en la página, escribe su correo aquí y vuelve a iniciar sesión. Aparece el menú "Administración".
2. **Crear pedidos de ejemplo:** 80 pedidos de los últimos 6 meses, para que el dashboard tenga datos en una presentación.
3. **Borrar los pedidos de ejemplo:** elimina solo esos (están marcados con `[DEMO]`).

Sin Windows: `python crear_admin.py correo@ejemplo.cl` en `backend/servicio-usuarios`, y `python datos_demo.py` (o `--borrar`) en `backend/servicio-pedidos`.

## Crear un administrador en Docker

Los usuarios nuevos quedan con rol `cliente`. Con Docker:

```bash
docker compose exec postgres psql -U changefuture -d usuarios_db \
  -c "UPDATE usuario SET id_rol = (SELECT id_rol FROM rol WHERE nombre_rol='administrador') WHERE correo='tu@correo.cl';"
```

Después vuelve a iniciar sesión para recibir un token con el nuevo rol.

## Próximos pasos sugeridos

1. Tablas restantes del modelo relacional: direcciones guardadas, envíos y pagos.
2. Un servicio de pagos (por ejemplo Webpay).
3. Avisar al cliente por correo cuando cambie el estado de su pedido o de su solicitud.
4. Pruebas automáticas para el gateway.
5. Migraciones con Flask-Migrate en lugar de `db.create_all()`.
