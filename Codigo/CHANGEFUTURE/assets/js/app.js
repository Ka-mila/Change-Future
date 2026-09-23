console.log("Change Future funcionando correctamente 🚀");
// =========================
// BASE DE PRODUCTOS / objeto:products
// =========================
const products = {
    1: {
        id: 1,
        name: "Figura personalizada",
        category: "Figuras 3D",
        price: 12990,
        image: "assets/images/productos/figura-personalizada.jpg",
        description:
            "Figura diseñada mediante impresión 3D, ideal para decoración, regalos o proyectos personalizados.",
        material: "PLA",
        fabrication: "Impresión 3D",
        customization: "Disponible" },
    2: {
        id: 2,
        name: "Decoración personalizada",
        category: "Decoración",
        price: 8990,
        image: "assets/images/productos/decoracion-personalizada.jpg",
        description:
            "Diseños únicos para decorar tus espacios.",
        material: "PLA",
        fabrication: "Impresión 3D",
        customization: "Disponible"},
    3: {
        id: 3,
        name: "Accesorio Gaming",
        category: "Gaming",
        price: 6990,
            image: "assets/images/productos/accesorio-gaming.jpg",
        description:
            "Accesorios impresos en 3D para tu setup.",
        material: "PLA",
        fabrication: "Impresión 3D",
        customization: "Disponible"},
    4: {
        id: 4,
        name: "Accesorio para vehículo",
        category: "Automotriz",
        price: 9990,
           image: "assets/images/productos/accesorio-vehiculo.jpg",
        description:
            "Piezas y accesorios personalizados mediante impresión 3D.",
        material: "PLA",
        fabrication: "Impresión 3D",
        customization: "Disponible"},
    5: {
        id: 5,
        name: "Macetero 3D",
        category: "Maceteros",
        price: 7990,
        image: "assets/images/productos/macetero-3d.jpg",
        description:
            "Maceteros con diseños modernos y diferentes tamaños.",
        material: "PLA",
        fabrication: "Impresión 3D",
        customization: "Disponible"}
};
// =========================
// CARGAR PRODUCTO
// =========================
function loadProduct() {
    const productName =
        document.getElementById("product-name");

    const productCategory =
        document.getElementById("product-category");

    const productPrice =
        document.getElementById("product-price");

    const productDescription =
        document.getElementById("product-description");

    const productMaterial =
        document.getElementById("product-material");

    const productFabrication =
        document.getElementById("product-fabrication");

    const productCustomization =
        document.getElementById("product-customization");

    const productImage =
        document.getElementById("product-image");

    // Si no estamos en producto.html
    if (!productName) return;

    // Obtener ID desde la URL
    const urlParams =
        new URLSearchParams(
            window.location.search );
    const productId =
        parseInt(
            urlParams.get("id")   );

    // Buscar producto
    const product =
        products[productId];
    // Producto inexistente
    if (!product) {
        productName.textContent =
            "Producto no encontrado";
        return;
    }
    // =========================
// MOSTRAR CATÁLOGO
// =========================
function loadCatalog() {
    const catalogContainer = document.getElementById("catalog-products");
    if (!catalogContainer) return;
    catalogContainer.innerHTML = "";
    Object.values(products).forEach(product => {
        const productElement = document.createElement("article");
        productElement.classList.add("shop-product");
        productElement.innerHTML = `
            <a href="Producto.html?id=${product.id}" class="shop-product-image">
                <span>3D</span>
            </a>
            <div class="shop-product-info">
                <span class="product-category">
                    ${product.category}
                </span>
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <div class="shop-product-bottom">
                <strong>
                    $${product.price.toLocaleString("es-CL")}
                    </strong>
                    <a href="Producto.html?id=${product.id}" class="btn-secondary">
                        Ver producto
                    </a>
                </div>
            </div>
        `;
        catalogContainer.appendChild(productElement);
    });
}
    // =========================
    // MOSTRAR INFORMACIÓN
    // =========================
    productName.textContent =
        product.name;
    productCategory.textContent =
        product.category.toUpperCase();
    productPrice.textContent =
        "$" +
        product.price.toLocaleString("es-CL");
    productDescription.textContent =
        product.description;

    productImage.src =
       product.image;
    productImage.alt =
       product.name;
    productMaterial.textContent =
        product.material;
    productFabrication.textContent =
        product.fabrication;
    productCustomization.textContent =
        product.customization;
}
// =========================
// CAMBIAR CANTIDAD
// =========================

function changeQuantity(value) {

    const quantityInput = document.getElementById("quantity");

    if (!quantityInput) return;

    let quantity = parseInt(quantityInput.value);

    quantity += value;

    if (quantity < 1) {
        quantity = 1;
    }

    quantityInput.value = quantity;
}



// =========================
// AGREGAR AL CARRITO
// =========================

function addToCart() {

    const quantityInput = document.getElementById("quantity");

    if (!quantityInput) return;

    const quantity = parseInt(quantityInput.value);

    // Obtener ID del producto desde la URL
    const urlParams = new URLSearchParams(
        window.location.search
    );

    const productId = parseInt(
        urlParams.get("id")
    );

    // Buscar producto en nuestra base de productos
    const product = products[productId];

    if (!product) {

        console.error("Producto no encontrado");

        return;
    }

    // Obtener carrito existente
    let cart = JSON.parse(
        localStorage.getItem("changeFutureCart")
    ) || [];

    // Buscar si el producto ya está en el carrito
    const existingProduct = cart.find(
        item => item.id === product.id
    );

    if (existingProduct) {

        // Si ya existe, sumar cantidad
        existingProduct.quantity += quantity;

    } else {

        // Si no existe, agregarlo
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity: quantity
        });

    }

    // Guardar carrito
    localStorage.setItem(
        "changeFutureCart",
        JSON.stringify(cart)
    );

    updateCartCount();

    // Mostrar mensaje
    const message =
        document.getElementById("cart-message");

    if (message) {

        message.textContent =
            "✓ Producto agregado al carrito";

    }

}
// =========================
// ACTUALIZAR CONTADOR CARRITO
// =========================

function updateCartCount() {

    const cartCount = document.getElementById("cart-count");

    if (!cartCount) return;

    const cart = JSON.parse(
        localStorage.getItem("changeFutureCart")
    ) || [];

    // Sumar todas las cantidades
    const totalQuantity = cart.reduce(
        (total, product) => total + product.quantity,
        0
    );

    cartCount.textContent = totalQuantity;

}
// =========================
// MOSTRAR CARRITO
// =========================

function loadCart() {

    const cartContainer = document.getElementById("cart-items");
    const totalElement = document.getElementById("cart-total");

    // Si no estamos en la página del carrito, no hacemos nada
    if (!cartContainer || !totalElement) return;

    // Obtener carrito desde localStorage
    let cart = JSON.parse(
        localStorage.getItem("changeFutureCart")
    ) || [];


    // Si el carrito está vacío
    if (cart.length === 0) {

        cartContainer.innerHTML = `
            <div class="cart-empty">

                <h2>
                    Tu carrito está vacío
                </h2>

                <p>
                    Todavía no has agregado productos.
                </p>

                <a href="catalogo.html" class="btn-primary">
                    Ver catálogo
                </a>

            </div>
        `;

        totalElement.textContent = "$0";

        return;
    }


    // Limpiar contenido anterior
    cartContainer.innerHTML = "";

    let total = 0;


    // Recorrer productos
    cart.forEach(product => {

        const productTotal =
            product.price * product.quantity;

        total += productTotal;


        const productElement = document.createElement("div");

        productElement.classList.add("cart-item");


        productElement.innerHTML = `

            <div class="cart-item-info">

                <div class="cart-item-image">
                    3D
                </div>

                <div>

                    <span>
                        Producto
                    </span>

                    <h3>
                        ${product.name}
                    </h3>

                    <p>
                        $${product.price.toLocaleString("es-CL")}
                    </p>

                </div>

            </div>


            <div class="cart-item-quantity">

                <button
                    onclick="updateCartQuantity(${product.id}, -1)"
                >
                    −
                </button>

                <span>
                    ${product.quantity}
                </span>

                <button
                    onclick="updateCartQuantity(${product.id}, 1)"
                >
                    +
                </button>

            </div>


            <strong class="cart-item-total">

                $${productTotal.toLocaleString("es-CL")}

            </strong>


            <button
                class="cart-remove"
                onclick="removeFromCart(${product.id})"
            >
                Eliminar
            </button>

        `;


        cartContainer.appendChild(productElement);

    });


    // Mostrar total
    totalElement.textContent =
        "$" + total.toLocaleString("es-CL");
}



// =========================
// CAMBIAR CANTIDAD EN CARRITO
// =========================

function updateCartQuantity(id, change) {

    let cart = JSON.parse(
        localStorage.getItem("changeFutureCart")
    ) || [];


    const product = cart.find(
        item => item.id === id
    );


    if (!product) return;


    product.quantity += change;


    // Si llega a 0, eliminar producto
    if (product.quantity <= 0) {

        cart = cart.filter(
            item => item.id !== id
        );

    }


    localStorage.setItem(
        "changeFutureCart",
        JSON.stringify(cart)
    );


    loadCart();
    updateCartCount();

}



// =========================
// ELIMINAR PRODUCTO
// =========================

function removeFromCart(id) {

    let cart = JSON.parse(
        localStorage.getItem("changeFutureCart")
    ) || [];


    cart = cart.filter(
        item => item.id !== id
    );


    localStorage.setItem(
        "changeFutureCart",
        JSON.stringify(cart)
    );

    updateCartCount();
    loadCart();
    

}



// =========================
// CARGAR CARRITO AL ABRIR
// =========================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadProduct();
        loadCatalog();
        loadCart();
        updateCartCount();

    }
);