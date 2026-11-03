# Change Future

Sitio estático en HTML, CSS y JavaScript. Sus archivos están separados y formateados para que puedas leerlos y seguir avanzando sin buscar código pegado en una sola línea.

## Páginas

- `index.html`: inicio y productos destacados.
- `catalogo.html`: búsqueda, filtros y orden de productos.
- `producto.html?id=1`: ficha de producto dinámica.
- `carrito.html`: cantidades, eliminación, subtotal y guardado local.
- `crea-desde-cero.html`: formulario guiado para una idea personalizada.
- `nosotros.html`: historia, compromisos y proceso de Change Future.

## Dónde editar

- `assets/css/style.css`: estilos, colores y adaptación a pantallas pequeñas.
- `assets/js/app.js`: catálogo, precios, fichas y comportamiento del carrito.
- `assets/images/product-placeholder.svg`: ilustración provisional para las fotos de producto.

Los colores principales están al comienzo de `style.css`, en las variables `--lime`, `--purple` y `--night`. Los tonos morados de las superficies centrales se aclararon un poco para dar más presencia a las fotografías.

## Cambiar las fotos de productos

La misma ilustración provisional aparece en las tarjetas y fichas mientras faltan las fotos reales. Guarda las fotos nuevas dentro de `assets/images/` y reemplaza la ruta `image` del producto correspondiente en `assets/js/app.js`. Por ejemplo:

```js
image: 'assets/images/macetero-real.jpg'
```

Las fotografías del proceso de impresión en Inicio, Crea desde cero y Nosotros se cargan desde Unsplash y requieren conexión a internet. Las páginas incluyen el crédito al fotógrafo.

## Carrito y formularios

El carrito conserva el formato y la clave `changeFutureCart` de **cf VERSION 1**. Si ambas versiones se abren desde el mismo dominio, podrán usar el mismo carrito; el almacenamiento de archivos `file://` puede variar según el navegador y la ruta.

Los precios de los cinco productos originales se mantienen. También se añadieron tres productos de ejemplo inspirados en el catálogo. El envío queda por coordinar. El formulario personalizado muestra una confirmación local, pero todavía no envía datos a un correo o servidor; el sitio no procesa pagos.

Abre `index.html` para comenzar. La carpeta original de OneDrive no se modificó.
