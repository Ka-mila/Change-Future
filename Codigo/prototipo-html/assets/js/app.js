// Change Future: catálogo, fichas de producto, carrito y formulario guiado.

const products = {
    1: {
        id: 1,
        name: 'Figura personalizada',
        category: 'Figuras 3D',
        price: 12990,
        description: 'Figura diseñada mediante impresión 3D, ideal para decoración, regalos o proyectos personalizados.',
        material: 'PLA',
        customization: 'Disponible',
        image: 'assets/images/product-placeholder.svg'
    },
    2: {
        id: 2,
        name: 'Decoración personalizada',
        category: 'Decoración',
        price: 8990,
        description: 'Diseños únicos para decorar tus espacios.',
        material: 'PLA',
        customization: 'Disponible',
        image: 'assets/images/product-placeholder.svg'
    },
    3: {
        id: 3,
        name: 'Accesorio Gaming',
        category: 'Gaming',
        price: 6990,
        description: 'Accesorios impresos en 3D para tu setup.',
        material: 'PLA',
        customization: 'Disponible',
        image: 'assets/images/product-placeholder.svg'
    },
    4: {
        id: 4,
        name: 'Accesorio para vehículo',
        category: 'Automotriz',
        price: 9990,
        description: 'Piezas y accesorios personalizados mediante impresión 3D.',
        material: 'PLA',
        customization: 'A medida',
        image: 'assets/images/product-placeholder.svg'
    },
    5: {
        id: 5,
        name: 'Macetero geométrico',
        category: 'Maceteros',
        price: 7990,
        description: 'Maceteros con diseños modernos y diferentes tamaños.',
        material: 'PLA',
        customization: 'Disponible',
        image: 'assets/images/product-placeholder.svg'
    },
    6: {
        id: 6,
        name: 'Llavero personalizado',
        category: 'Llaveros',
        price: 3990,
        description: 'Un llavero con tu nombre, iniciales o diseño favorito.',
        material: 'PLA',
        customization: 'Personalizable',
        image: 'assets/images/product-placeholder.svg'
    },
    7: {
        id: 7,
        name: 'Soporte para celular',
        category: 'Soportes',
        price: 5990,
        description: 'Soporte compacto para mantener tu teléfono a la vista.',
        material: 'PLA',
        customization: 'Disponible',
        image: 'assets/images/product-placeholder.svg'
    },
    8: {
        id: 8,
        name: 'Organizador de escritorio',
        category: 'Organizadores',
        price: 12990,
        description: 'Ordena lápices, herramientas y accesorios con estilo.',
        material: 'PLA',
        customization: 'A medida',
        image: 'assets/images/product-placeholder.svg'
    }
};

const CART_KEY = 'changeFutureCart';

function formatPrice(value) {
    return new Intl.NumberFormat('es-CL', {
        style: 'currency',
        currency: 'CLP',
        maximumFractionDigits: 0
    }).format(value);
}

function readCart() {
    try {
        const savedCart = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
        return Array.isArray(savedCart) ? savedCart : [];
    } catch {
        return [];
    }
}

function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
    updateCartCount();
}

function updateCartCount() {
    const count = readCart().reduce((total, item) => {
        return total + Number(item.quantity || 0);
    }, 0);

    document.querySelectorAll('[data-cart-count]').forEach((badge) => {
        badge.textContent = count;
    });
}

function createProductCard(product) {
    return `
        <article class="product-card">
            <a class="product-photo" href="producto.html?id=${product.id}">
                <img src="${product.image}" alt="Vista previa: ${product.name}">
                <span class="product-tag">${product.category}</span>
            </a>
            <div class="product-info">
                <h3>${product.name}</h3>
                <p>${product.description}</p>
                <span class="price">${formatPrice(product.price)}</span>
                <div class="product-bottom">
                    <button
                        class="icon-button"
                        type="button"
                        data-add-to-cart="${product.id}"
                        aria-label="Agregar ${product.name} al carrito"
                    >＋</button>
                    <a class="text-link" href="producto.html?id=${product.id}">
                        Ver producto&nbsp; →
                    </a>
                </div>
            </div>
        </article>
    `;
}

function loadFeaturedProducts() {
    const container = document.querySelector('[data-featured-products]');
    if (!container) return;

    const featured = [products[5], products[6], products[7], products[8]];
    container.innerHTML = featured.map(createProductCard).join('');
}

function loadCatalog() {
    const container = document.querySelector('[data-catalog-grid]');
    if (!container) return;

    let selectedCategory = 'Todos';
    let searchTerm = '';
    let sortOrder = 'recommended';

    function renderCatalog() {
        let visibleProducts = Object.values(products).filter((product) => {
            const matchesCategory = selectedCategory === 'Todos'
                || product.category === selectedCategory;
            const searchableText = `${product.name} ${product.category} ${product.description}`
                .toLocaleLowerCase('es');
            const matchesSearch = searchableText.includes(searchTerm.toLocaleLowerCase('es'));

            return matchesCategory && matchesSearch;
        });

        if (sortOrder === 'price-low') {
            visibleProducts.sort((a, b) => a.price - b.price);
        } else if (sortOrder === 'price-high') {
            visibleProducts.sort((a, b) => b.price - a.price);
        } else if (sortOrder === 'name') {
            visibleProducts.sort((a, b) => a.name.localeCompare(b.name, 'es'));
        }

        container.innerHTML = visibleProducts.length
            ? visibleProducts.map(createProductCard).join('')
            : '<div class="empty-state"><h2>No encontramos productos</h2><p>Prueba con otra búsqueda o categoría.</p></div>';

        const resultCount = document.querySelector('[data-results]');
        if (resultCount) {
            const noun = visibleProducts.length === 1 ? 'producto' : 'productos';
            resultCount.textContent = `${visibleProducts.length} ${noun}`;
        }
    }

    document.querySelectorAll('[data-category]').forEach((button) => {
        button.addEventListener('click', () => {
            document.querySelectorAll('[data-category]').forEach((item) => {
                item.classList.remove('active');
            });
            button.classList.add('active');
            selectedCategory = button.dataset.category;
            renderCatalog();
        });
    });

    const searchField = document.querySelector('[data-search]');
    if (searchField) {
        searchField.addEventListener('input', () => {
            searchTerm = searchField.value.trim();
            renderCatalog();
        });
    }

    const sortField = document.querySelector('[data-sort]');
    if (sortField) {
        sortField.addEventListener('change', () => {
            sortOrder = sortField.value;
            renderCatalog();
        });
    }

    renderCatalog();
}

function loadProduct() {
    const container = document.querySelector('[data-product-detail]');
    if (!container) return;

    const productId = Number(new URLSearchParams(window.location.search).get('id'));
    const product = products[productId];

    if (!product) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">?</div>
                <h1>Producto no encontrado</h1>
                <p>Puede que el enlace esté incompleto.</p>
                <a class="btn" href="catalogo.html">Volver al catálogo</a>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="detail-photo">
            <img src="${product.image}" alt="Vista previa: ${product.name}">
        </div>
        <div class="detail-info">
            <span class="product-category">${product.category.toUpperCase()}</span>
            <h1>${product.name}</h1>
            <p class="detail-price">${formatPrice(product.price)}</p>
            <p class="detail-description">${product.description}</p>
            <div class="feature-list">
                <div><b>Material</b>${product.material}</div>
                <div><b>Fabricación</b>Impresión 3D</div>
                <div><b>Personalización</b>${product.customization}</div>
            </div>
            <label class="form-label" for="product-quantity">Cantidad</label>
            <div class="quantity-control">
                <button type="button" data-product-quantity="-1" aria-label="Disminuir cantidad">−</button>
                <input id="product-quantity" type="number" min="1" value="1" inputmode="numeric">
                <button type="button" data-product-quantity="1" aria-label="Aumentar cantidad">＋</button>
            </div>
            <div class="product-actions">
                <button class="btn" type="button" data-add-to-cart="${product.id}">Agregar al carrito</button>
                <a class="btn secondary" href="crea-desde-cero.html">Quiero personalizarlo</a>
            </div>
            <p class="muted" style="margin-top: 14px; font-size: 11px;">El envío se coordina según tu comuna.</p>
        </div>
    `;
}

function addToCart(productId, quantity = 1) {
    const product = products[Number(productId)];
    if (!product) return;

    const cart = readCart();
    const currentItem = cart.find((item) => Number(item.id) === product.id);

    if (currentItem) {
        currentItem.quantity = Number(currentItem.quantity) + quantity;
    } else {
        cart.push({
            id: product.id,
            name: product.name,
            price: product.price,
            quantity,
            image: product.image,
            category: product.category
        });
    }

    saveCart(cart);
    showToast(`${product.name} se agregó al carrito.`);
}

function renderCart() {
    const container = document.querySelector('[data-cart-container]');
    if (!container) return;

    const cart = readCart().filter((item) => products[item.id]);
    const subtotal = cart.reduce((sum, item) => {
        return sum + products[item.id].price * Number(item.quantity);
    }, 0);
    const emptyState = document.querySelector('[data-empty-cart]');
    const cartContent = document.querySelector('[data-cart-content]');

    if (cart.length === 0) {
        emptyState?.classList.remove('hidden');
        cartContent?.classList.add('hidden');
        return;
    }

    emptyState?.classList.add('hidden');
    cartContent?.classList.remove('hidden');

    container.innerHTML = cart.map((item) => {
        const product = products[item.id];
        const quantity = Number(item.quantity);

        return `
            <article class="cart-row">
                <a class="cart-thumb" href="producto.html?id=${product.id}">
                    <img src="${product.image}" alt="Vista previa: ${product.name}">
                </a>
                <div class="cart-name">
                    ${product.name}
                    <small>${product.category}</small>
                    <small>${formatPrice(product.price)} por unidad</small>
                </div>
                <div class="quantity-control">
                    <button type="button" data-cart-step="-1" data-id="${product.id}" aria-label="Disminuir">−</button>
                    <input type="number" min="1" value="${quantity}" data-cart-quantity="${product.id}" aria-label="Cantidad de ${product.name}">
                    <button type="button" data-cart-step="1" data-id="${product.id}" aria-label="Aumentar">＋</button>
                </div>
                <div class="cart-line-total">${formatPrice(product.price * quantity)}</div>
                <button class="remove-button" type="button" data-remove-item="${product.id}" aria-label="Eliminar ${product.name}">×</button>
            </article>
        `;
    }).join('');

    document.querySelectorAll('[data-subtotal], [data-total]').forEach((element) => {
        element.textContent = formatPrice(subtotal);
    });
}

function updateCartQuantity(productId, change) {
    const cart = readCart();
    const item = cart.find((row) => Number(row.id) === Number(productId));
    if (!item) return;

    item.quantity = Math.max(1, Number(item.quantity) + change);
    saveCart(cart);
    renderCart();
}

function setCartQuantity(productId, quantity) {
    const cart = readCart();
    const item = cart.find((row) => Number(row.id) === Number(productId));
    if (!item) return;

    item.quantity = Math.max(1, Math.floor(Number(quantity) || 1));
    saveCart(cart);
    renderCart();
}

function showToast(message) {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove('show'), 2600);
}

function setupWhatsAppOrder() {
    const button = document.querySelector('[data-whatsapp-order]');
    if (!button) return;
    const deliverySelect = document.querySelector('[data-delivery-method]');
const blueFields = document.querySelector('[data-blue-fields]');
const metroFields = document.querySelector('[data-metro-fields]');
const metroStation = document.querySelector('[name="metroStation"]');

function updateDeliveryFields() {
    const isBlue = deliverySelect.value === 'blue';
    const isMetro = deliverySelect.value === 'metro';

    blueFields.hidden = !isBlue;
    metroFields.hidden = !isMetro;

    blueFields.querySelectorAll('input').forEach((field) => {
        field.required = isBlue && field.name !== 'reference';
    });

    metroStation.required = isMetro;
}

deliverySelect.addEventListener('change', updateDeliveryFields);
updateDeliveryFields();

    button.addEventListener('click', () => {
        const form = document.querySelector('[data-order-form]');
        if (!form.reportValidity()) return;
        const orderData = new FormData(form);
        const items = readCart().filter((item) => products[item.id]);

        if (items.length === 0) {
            alert('Tu carrito está vacío.');
            return;
        }

        const subtotal = items.reduce((total, item) => {
            const quantity = Number(item.quantity) || 1;
            return total + products[item.id].price * quantity;
        }, 0);

        const details = items.map((item) => {
            const product = products[item.id];
            const quantity = Number(item.quantity) || 1;
            return `• ${product.name} x ${quantity}: ${formatPrice(product.price * quantity)}`;
        });

       const deliveryMethod = orderData.get('deliveryMethod');

    const deliveryDetails = deliveryMethod === 'blue'
    ? [
        '🚚 Despacho: Blue Express',
        `Comuna: ${orderData.get('commune')}`,
        `Dirección: ${orderData.get('address')}`,
        orderData.get('reference')
            ? `Referencia: ${orderData.get('reference')}`
            : null,
        'Costo del envío: pendiente de cotización'
    ].filter(Boolean)
    : [
        `🚇 Entrega en Metro: ${orderData.get('metroStation')}`,
        `Horario preferido: ${orderData.get('meetingTime') || 'A coordinar'}`
    ];

    const message = [
    '🟢 CHANGE FUTURE | SOLICITUD DE PEDIDO',
    '',
    `Cliente: ${orderData.get('customerName')}`,
    `Teléfono: ${orderData.get('customerPhone')}`,
    '',
    'PRODUCTOS',
    ...details,
    '',
    `Subtotal productos: ${formatPrice(subtotal)}`,
    '',
    'ENTREGA',
    ...deliveryDetails,
    '',
    'Total final: pendiente de confirmar por WhatsApp'
    ].join('\n');
        const whatsappNumber = '56956912535';
        const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    });
}


function setupIdeaForm() {
    const form = document.querySelector('[data-idea-form]');
    if (!form) return;

    let currentStep = 0;
    const state = {
        kind: '',
        idea: '',
        size: 'Aún no definido',
        quantity: '1 unidad',
        color: 'Por conversar'
    };
    const formSteps = [...form.querySelectorAll('[data-form-step]')];
    const indicators = [...document.querySelectorAll('[data-step-indicator]')];

    function updateSummary() {
        const summaryFields = {
            kind: 'summary-kind',
            idea: 'summary-idea',
            size: 'summary-size',
            quantity: 'summary-quantity',
            color: 'summary-color'
        };

        Object.entries(summaryFields).forEach(([key, id]) => {
            const element = document.getElementById(id);
            if (!element) return;

            const fallback = key === 'idea' ? 'Cuéntanos tu idea' : 'Por definir';
            const text = state[key] || fallback;
            element.textContent = key === 'idea' && text.length > 52
                ? `${text.slice(0, 52)}…`
                : text;
        });
    }

    function showStep(step) {
        currentStep = step;
        formSteps.forEach((element, index) => {
            element.classList.toggle('active', index === step);
        });
        indicators.forEach((element, index) => {
            element.classList.toggle('active', index === step);
        });

        if (step < 3) {
            document.getElementById('solicitud')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    }

    form.querySelectorAll('[data-choice-group]').forEach((group) => {
        group.addEventListener('click', (event) => {
            const choice = event.target.closest('[data-choice]');
            if (!choice) return;

            group.querySelectorAll('[data-choice]').forEach((button) => {
                button.classList.remove('selected');
            });
            choice.classList.add('selected');
            state[group.dataset.choiceGroup] = choice.dataset.choice;
            updateSummary();
        });
    });

    const ideaField = form.querySelector('[name="idea"]');
    ideaField?.addEventListener('input', () => {
        state.idea = ideaField.value.trim();
        updateSummary();
    });

    ['size', 'quantity', 'color'].forEach((fieldName) => {
        const field = form.querySelector(`[name="${fieldName}"]`);
        field?.addEventListener('change', () => {
            state[fieldName] = field.value;
            updateSummary();
        });
    });

    form.querySelectorAll('[data-next-step]').forEach((button) => {
        button.addEventListener('click', () => {
            if (currentStep === 0 && !state.kind) {
                showToast('Elige una categoría para continuar.');
                return;
            }
            showStep(currentStep + 1);
        });
    });

    form.querySelectorAll('[data-prev-step]').forEach((button) => {
        button.addEventListener('click', () => showStep(currentStep - 1));
    });

    const fileInput = form.querySelector('[name="reference"]');
    fileInput?.addEventListener('change', () => {
        const fileLabel = document.querySelector('[data-file-name]');
        if (fileLabel) {
            fileLabel.textContent = fileInput.files[0]
                ? `Referencia: ${fileInput.files[0].name}`
                : '';
        }
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (form.reportValidity()) showStep(3);
    });

    document.querySelector('[data-restart]')?.addEventListener('click', () => {
        form.reset();
        Object.assign(state, {
            kind: '',
            idea: '',
            size: 'Aún no definido',
            quantity: '1 unidad',
            color: 'Por conversar'
        });
        form.querySelectorAll('[data-choice]').forEach((button) => {
            button.classList.remove('selected');
        });
        const fileLabel = document.querySelector('[data-file-name]');
        if (fileLabel) fileLabel.textContent = '';
        updateSummary();
        showStep(0);
    });
}

document.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add-to-cart]');
    if (addButton) {
        const quantityField = document.getElementById('product-quantity');
        const quantity = quantityField
            ? Math.max(1, Number(quantityField.value) || 1)
            : 1;
        addToCart(addButton.dataset.addToCart, quantity);
        return;
    }

    const productQuantityButton = event.target.closest('[data-product-quantity]');
    if (productQuantityButton) {
        const field = document.getElementById('product-quantity');
        if (field) {
            field.value = Math.max(
                1,
                (Number(field.value) || 1) + Number(productQuantityButton.dataset.productQuantity)
            );
        }
        return;
    }

    const cartStepButton = event.target.closest('[data-cart-step]');
    if (cartStepButton) {
        updateCartQuantity(cartStepButton.dataset.id, Number(cartStepButton.dataset.cartStep));
        return;
    }

    const removeButton = event.target.closest('[data-remove-item]');
    if (removeButton) {
        const remainingItems = readCart().filter((item) => {
            return Number(item.id) !== Number(removeButton.dataset.removeItem);
        });
        saveCart(remainingItems);
        renderCart();
        return;
    }

    const menuButton = event.target.closest('[data-menu-toggle]');
    if (menuButton) {
        document.querySelector('[data-nav]')?.classList.toggle('open');
    }
});

document.addEventListener('change', (event) => {
    const quantityField = event.target.closest('[data-cart-quantity]');
    if (quantityField) {
        setCartQuantity(quantityField.dataset.cartQuantity, quantityField.value);
    }
});
function updateAccountLink() {
    let user = null;

    try {
        user = JSON.parse(localStorage.getItem('cfDemoUser') || 'null');
    } catch {
        user = null;
    }

    document.querySelectorAll('[data-account-link]').forEach((link) => {
        link.textContent = user
            ? `Hola, ${user.name.split(' ')[0]}`
            : 'Ingresar';
    });
}
function setupLogin() {
    const form = document.querySelector('[data-login-form]');
    if (!form) return;

    const nameField = form.querySelector('[name="name"]');
    const nameLabel = form.querySelector('[data-name-label]');
    const emailField = form.querySelector('[name="email"]');
    const message = form.querySelector('[data-login-message]');
    const submitButton = form.querySelector('[data-login-submit]');
    const logoutButton = document.querySelector('[data-logout]');
    const modeButtons = document.querySelectorAll('[data-login-mode]');
    let mode = 'login';

    function changeMode(newMode) {
        mode = newMode;
        const creatingAccount = mode === 'register';

        nameField.hidden = !creatingAccount;
        nameLabel.hidden = !creatingAccount;
        nameField.required = creatingAccount;
        submitButton.textContent = creatingAccount ? 'Crear cuenta' : 'Ingresar';
        message.textContent = '';

        modeButtons.forEach((button) => {
            button.classList.toggle(
                'active',
                button.dataset.loginMode === mode
            );
        });
    }

    modeButtons.forEach((button) => {
        button.addEventListener('click', () => {
            changeMode(button.dataset.loginMode);
        });
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!form.reportValidity()) return;

        const email = emailField.value.trim().toLowerCase();
        const password = form.querySelector('[name="password"]').value;
        let savedUser = null;

        try {
            savedUser = JSON.parse(localStorage.getItem('cfDemoAccount') || 'null');
        } catch {
            savedUser = null;
        }

        if (mode === 'register') {
          
            savedUser = {
                name: nameField.value.trim(),
                email: email,
                password: password
            };

            try {
                localStorage.setItem('cfDemoAccount', JSON.stringify(
                     savedUser));
            } catch {
                message.textContent = 'No se pudo iniciar la sesion.';
                return;
            }
        } else if (
            !savedUser ||
            savedUser.email !== email ||
            savedUser.password !== password) {
            message.textContent = ' Correo o Constraseña incorrectos';
            return;
        }
        try {
             localStorage.setItem('cfDemoUser', JSON.stringify({
               name: savedUser.name,
               email: savedUser.email
         }));
        } catch {
             message.textContent = 'No se pudo iniciar la sesión.';
             return;
        }
        message.textContent = `¡Hola, ${savedUser.name}! Sesión de demostración iniciada.`;
        updateAccountLink();
        logoutButton?.classList.remove('hidden');  
        
    });
    logoutButton?.addEventListener('click', () => {  
    try {
        localStorage.removeItem('cfDemoUser');
    } catch {
        // No se pudo borrar la sesión.
    }
    form.reset();
    changeMode('login');
    logoutButton?.classList.add('hidden');
    updateAccountLink();
    message.textContent = 'Sesión cerrada.';
});
try {
        if (localStorage.getItem('cfDemoUser')) {
        logoutButton?.classList.remove('hidden');
    }
} catch {
    // No se pudo revisar la sesión.
}
  
    changeMode('login');
}

document.addEventListener('DOMContentLoaded', () => {
    updateCartCount();
    loadFeaturedProducts();
    loadCatalog();
    loadProduct();
    renderCart();
    setupIdeaForm();
    setupLogin(updateAccountLink);
    updateAccountLink();
    setupWhatsAppOrder();


const hero = document.querySelector(".hero");
const logo = document.querySelector(".hero-logo");

if (hero && logo) {
  hero.addEventListener("pointermove", (event) => {
    const area = hero.getBoundingClientRect();
    const x = (event.clientX - area.left) / area.width - 0.5;
    const y = (event.clientY - area.top) / area.height - 0.5;

    logo.style.setProperty("--logo-x", `${x * 18}px`);
    logo.style.setProperty("--logo-y", `${y * 12}px`);
    logo.style.setProperty("--logo-rx", `${y * -12}deg`);
    logo.style.setProperty("--logo-ry", `${x * 16}deg`);
  });

  hero.addEventListener("pointerleave", () => {
    logo.style.setProperty("--logo-x", "0px");
    logo.style.setProperty("--logo-y", "0px");
    logo.style.setProperty("--logo-rx", "0deg");
    logo.style.setProperty("--logo-ry", "0deg");
  });
}



});

