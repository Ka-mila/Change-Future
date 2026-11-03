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
   │        └──► servicio-catalogo   (consulta precios reales)
   └──► servicio-personalizacion :5004   → personalizacion_db
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
│   └── servicio-personalizacion/  # solicitudes "Crea desde cero" con imagen de referencia
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

Puertos: gateway 5000, usuarios 5001, catálogo 5002, pedidos 5003, personalización 5004.

```bash
# Frontend
cd Codigo/frontend
npm install
npm run dev
```

## Endpoints (a través del gateway)

| Método | Ruta                                   | Servicio        | Descripción |
|--------|----------------------------------------|-----------------|-------------|
| POST   | `/api/usuarios/registro`               | usuarios        | Crea una cuenta y devuelve un token |
| POST   | `/api/usuarios/login`                  | usuarios        | Inicia sesión |
| GET    | `/api/usuarios/perfil`                 | usuarios        | Datos del usuario (requiere token) |
| GET    | `/api/catalogo/categorias`             | catálogo        | Lista de categorías |
| GET    | `/api/catalogo/productos`              | catálogo        | `?categoria=`, `?q=`, `?orden=price-low\|price-high\|name`, `?destacados=true` |
| GET    | `/api/catalogo/productos/<id>`         | catálogo        | Ficha de producto |
| POST   | `/api/catalogo/productos`              | catálogo        | Crear producto (administrador) |
| POST   | `/api/pedidos/pedidos`                 | pedidos         | Registra un pedido (con o sin sesión) |
| GET    | `/api/pedidos/pedidos`                 | pedidos         | Mis pedidos (o todos, si eres administrador) |
| PATCH  | `/api/pedidos/pedidos/<id>/estado`     | pedidos         | Cambiar estado (administrador) |
| POST   | `/api/personalizacion/solicitudes`     | personalización | Solicitud "Crea desde cero" (multipart) |
| GET    | `/api/personalizacion/solicitudes`     | personalización | Mis solicitudes (o todas, si eres administrador) |

## Ideas clave de la arquitectura

- **API Gateway:** el frontend solo conoce `/api`. El gateway decide a qué servicio va cada petición, así los servicios pueden moverse o escalar sin cambiar el frontend.
- **Base de datos por servicio:** cada servicio es dueño de sus tablas. Por eso `pedido.id_usuario` no es una clave foránea real: el usuario vive en otra base de datos.
- **Comunicación entre servicios:** al crear un pedido, `servicio-pedidos` consulta a `servicio-catalogo` el precio de cada producto, en vez de confiar en el precio que manda el navegador.
- **Autenticación con JWT:** `servicio-usuarios` firma el token y los demás servicios lo verifican con la misma clave (`JWT_SECRET`). Cámbiala en producción.

## Crear un administrador

Los usuarios nuevos quedan con rol `cliente`. Para promover uno a administrador en Docker:

```bash
docker compose exec postgres psql -U changefuture -d usuarios_db \
  -c "UPDATE usuario SET id_rol = (SELECT id_rol FROM rol WHERE nombre_rol='administrador') WHERE correo='tu@correo.cl';"
```

Después vuelve a iniciar sesión para recibir un token con el nuevo rol.

## Próximos pasos sugeridos

1. Pantallas de administración en React (productos, pedidos, solicitudes).
2. Tablas restantes del modelo relacional: colores, tamaños, direcciones, envíos y pagos.
3. Un servicio de pagos (por ejemplo Webpay) y la integración con la API de IA para propuestas de diseño.
4. Pruebas automáticas con `pytest` para cada servicio.
5. Migraciones con Flask-Migrate en lugar de `db.create_all()`.
