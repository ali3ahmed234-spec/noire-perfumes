// ======================================
// NOIRÉ - SUPABASE STORE
// ======================================

const SUPABASE_URL = "https://pikbxycwvqfjxncjlzrf.supabase.co";

const SUPABASE_KEY = "sb_publishable_-Q7fUiauwtRFP7xfS6dv7w_mxWR7Qjx";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const storeWhatsApp = "201003413439";

const CART_STORAGE_KEY = "noire_cart";
const MAX_ITEM_QUANTITY = 99;

// ======================================
// ELEMENTS
// ======================================

const languageBtn = document.getElementById("languageBtn");
const cartItemsEl = document.getElementById("cartItems");
const totalPriceEl = document.getElementById("totalPrice");
const checkoutBtn = document.getElementById("checkoutBtn");
const checkoutForm = document.getElementById("checkoutForm");
const productContainer = document.getElementById("productContainer");

const productModal = document.getElementById("productModal");
const closeModal = document.getElementById("closeModal");
const modalName = document.getElementById("modalName");
const modalDescription = document.getElementById("modalDescription");
const modalPrice = document.getElementById("modalPrice");
const modalProductImage = document.getElementById("modalProductImage");
const modalAddToCart = document.getElementById("modalAddToCart");

const customerPhoneInput = document.getElementById("customerPhone");

let currentLanguage = "ar";
let cart = loadCart();
let products = [];
let selectedProductId = null;

// ======================================
// PHONE FIELD (mobile keyboard + validation)
// ======================================

if (customerPhoneInput) {
    customerPhoneInput.setAttribute("inputmode", "tel");
    customerPhoneInput.setAttribute("autocomplete", "tel");
    customerPhoneInput.setAttribute("pattern", "01[0-9]{9}");
    customerPhoneInput.setAttribute(
        "title",
        "رقم موبايل مصري من 11 رقم، مثال: 01012345678"
    );
}

// ======================================
// SMALL STYLE FOR + / - BUTTONS IN CART
// ======================================

(function addCartButtonStyles() {
    const style = document.createElement("style");

    style.textContent = `
        .cart-qty {
            display: inline-flex;
            align-items: center;
            gap: 8px;
        }
        .qty-btn {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            border: 1px solid currentColor;
            background: transparent;
            color: inherit;
            font-size: 18px;
            line-height: 1;
            cursor: pointer;
            padding: 0;
        }
    `;

    document.head.appendChild(style);
})();

// ======================================
// CART STORAGE (keeps the cart after refresh)
// ======================================

function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));

        if (!Array.isArray(saved)) return [];

        return saved.filter(function(item) {
            return (
                item &&
                typeof item.id === "string" &&
                Number.isFinite(Number(item.price)) &&
                Number.isInteger(item.quantity) &&
                item.quantity > 0
            );
        }).map(function(item) {
            return {
                id: item.id,
                nameAr: String(item.nameAr || item.nameEn || ""),
                nameEn: String(item.nameEn || item.nameAr || ""),
                price: Number(item.price),
                quantity: Math.min(item.quantity, MAX_ITEM_QUANTITY)
            };
        });
    } catch (error) {
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch (error) {
        // storage not available: the cart still works for this visit
    }
}

// ======================================
// ESCAPE HTML
// ======================================

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, function(char) {
        return {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        }[char];
    });
}

// ======================================
// GET PRODUCTS FROM SUPABASE
// ======================================

async function getProducts() {
    productContainer.innerHTML =
        currentLanguage === "ar"
            ? "<p>جاري تحميل المنتجات...</p>"
            : "<p>Loading products...</p>";

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Supabase error:", error);

        productContainer.innerHTML =
            currentLanguage === "ar"
                ? "<p>حدث خطأ أثناء تحميل المنتجات. حاول تحديث الصفحة.</p>"
                : "<p>Error loading products. Please refresh the page.</p>";

        return;
    }

    products = data || [];

    renderProducts();
}

// ======================================
// RENDER PRODUCTS
// ======================================

function renderProducts() {
    productContainer.innerHTML = "";

    if (products.length === 0) {
        productContainer.innerHTML =
            currentLanguage === "ar"
                ? "<p>لا توجد منتجات حالياً</p>"
                : "<p>No products available</p>";
        return;
    }

    products.forEach(function(product) {
        const nameAr = escapeHTML(product.name_ar || product.name);
        const nameEn = escapeHTML(product.name || product.name_ar);

        const descriptionAr = escapeHTML(product.description_ar || "");
        const descriptionEn = escapeHTML(product.description || "");

        const image = escapeHTML(product.image || "");
        const price = Number(product.price) || 0;
        const id = escapeHTML(product.id);

        const card = document.createElement("div");
        card.className = "product-card";

        card.innerHTML = `
            <div class="product-image">
                <img src="${image}"
                     alt="${nameEn}"
                     loading="lazy"
                     onerror="this.style.display='none'">
            </div>

            <div class="product-info">
                <h3 data-ar="${nameAr}" data-en="${nameEn}">
                    ${nameAr}
                </h3>

                <p data-ar="${descriptionAr}" data-en="${descriptionEn}">
                    ${descriptionAr}
                </p>

                <strong>${price.toLocaleString("en-US")} EGP</strong>

                <button class="view-details"
                    data-id="${id}"
                    data-ar="تفاصيل المنتج"
                    data-en="Product Details">
                    تفاصيل المنتج
                </button>

                <button class="add-to-cart"
                    data-id="${id}"
                    data-ar="أضف للسلة"
                    data-en="Add To Cart">
                    أضف للسلة
                </button>
            </div>
        `;

        productContainer.appendChild(card);
    });

    applyLanguage();
}

// ======================================
// PRODUCT MODAL
// ======================================

function fillModal(product) {
    modalName.textContent =
        currentLanguage === "ar"
            ? product.name_ar || product.name
            : product.name || product.name_ar;

    modalDescription.textContent =
        currentLanguage === "ar"
            ? product.description_ar || ""
            : product.description || "";

    modalPrice.textContent =
        Number(product.price).toLocaleString("en-US") + " EGP";

    modalProductImage.src = product.image || "";
    modalProductImage.style.display = "";
}

// ======================================
// LANGUAGE SYSTEM
// ======================================

function applyLanguage() {
    document.documentElement.lang = currentLanguage;

    document.documentElement.dir =
        currentLanguage === "ar" ? "rtl" : "ltr";

    document.querySelectorAll("[data-ar]").forEach(function(element) {
        const translation = element.getAttribute(
            "data-" + currentLanguage
        );

        if (translation !== null) {
            element.textContent = translation;
        }
    });

    document.querySelectorAll("[data-placeholder-ar]").forEach(function(element) {
        element.placeholder = element.getAttribute(
            "data-placeholder-" + currentLanguage
        );
    });

    languageBtn.textContent =
        currentLanguage === "ar" ? "EN" : "AR";

    // If the details window is open, switch its language too
    if (productModal.style.display === "flex") {
        const openProduct = products.find(function(item) {
            return String(item.id) === String(selectedProductId);
        });

        if (openProduct) {
            fillModal(openProduct);
        }
    }

    renderCart();
}

languageBtn.addEventListener("click", function() {
    currentLanguage = currentLanguage === "ar" ? "en" : "ar";
    applyLanguage();
});

// ======================================
// ADD TO CART
// ======================================

function addToCart(product) {
    const id = String(product.id);

    const existing = cart.find(function(item) {
        return item.id === id;
    });

    if (existing) {
        existing.quantity = Math.min(existing.quantity + 1, MAX_ITEM_QUANTITY);
    } else {
        cart.push({
            id: id,
            nameAr: product.name_ar || product.name,
            nameEn: product.name || product.name_ar,
            price: Number(product.price),
            quantity: 1
        });
    }

    renderCart();
}

// ======================================
// RENDER CART
// ======================================

function renderCart() {
    cartItemsEl.innerHTML = "";

    if (cart.length === 0) {
        const p = document.createElement("p");

        p.textContent =
            currentLanguage === "ar"
                ? "السلة فارغة حالياً"
                : "Your cart is empty";

        cartItemsEl.appendChild(p);
        totalPriceEl.textContent = "0";
        saveCart();
        return;
    }

    let total = 0;

    cart.forEach(function(item, index) {
        total += item.price * item.quantity;

        const row = document.createElement("div");
        row.className = "cart-item";

        const name = document.createElement("span");

        name.textContent =
            currentLanguage === "ar" ? item.nameAr : item.nameEn;

        // quantity controls: [-] 2 [+]
        const qty = document.createElement("span");
        qty.className = "cart-qty";

        const minus = document.createElement("button");
        minus.type = "button";
        minus.className = "qty-btn";
        minus.textContent = "−";
        minus.setAttribute("aria-label", "-");

        minus.addEventListener("click", function() {
            if (item.quantity > 1) {
                item.quantity--;
            } else {
                cart.splice(index, 1);
            }
            renderCart();
        });

        const count = document.createElement("span");
        count.textContent = item.quantity;

        const plus = document.createElement("button");
        plus.type = "button";
        plus.className = "qty-btn";
        plus.textContent = "+";
        plus.setAttribute("aria-label", "+");

        plus.addEventListener("click", function() {
            if (item.quantity < MAX_ITEM_QUANTITY) {
                item.quantity++;
                renderCart();
            }
        });

        qty.appendChild(minus);
        qty.appendChild(count);
        qty.appendChild(plus);

        const price = document.createElement("span");

        price.textContent =
            (item.price * item.quantity).toLocaleString("en-US")
            + " EGP";

        const remove = document.createElement("button");
        remove.type = "button";
        remove.className = "remove-btn";
        remove.textContent = "✕";

        remove.addEventListener("click", function() {
            cart.splice(index, 1);
            renderCart();
        });

        row.appendChild(name);
        row.appendChild(qty);
        row.appendChild(price);
        row.appendChild(remove);

        cartItemsEl.appendChild(row);
    });

    totalPriceEl.textContent = total.toLocaleString("en-US");

    saveCart();
}

// ======================================
// PRODUCT BUTTONS
// ======================================

productContainer.addEventListener("click", function(event) {
    const addButton = event.target.closest(".add-to-cart");
    const detailsButton = event.target.closest(".view-details");

    if (addButton) {
        const product = products.find(function(item) {
            return String(item.id) === String(addButton.dataset.id);
        });

        if (product) {
            addToCart(product);
        }
    }

    if (detailsButton) {
        const product = products.find(function(item) {
            return String(item.id) === String(detailsButton.dataset.id);
        });

        if (!product) return;

        selectedProductId = product.id;

        fillModal(product);

        productModal.style.display = "flex";
    }
});

// ======================================
// EXPLORE BUTTON
// ======================================

document.getElementById("exploreBtn").addEventListener("click", function() {
    document.getElementById("products").scrollIntoView({
        behavior: "smooth"
    });
});

// ======================================
// CLOSE MODAL
// ======================================

closeModal.addEventListener("click", function() {
    productModal.style.display = "none";
});

productModal.addEventListener("click", function(event) {
    if (event.target === productModal) {
        productModal.style.display = "none";
    }
});

document.addEventListener("keydown", function(event) {
    if (event.key === "Escape") {
        productModal.style.display = "none";
    }
});

// ======================================
// ADD FROM MODAL
// ======================================

modalAddToCart.addEventListener("click", function() {
    const product = products.find(function(item) {
        return String(item.id) === String(selectedProductId);
    });

    if (product) {
        addToCart(product);
        productModal.style.display = "none";
    }
});

// ======================================
// CHECKOUT BUTTON
// ======================================

checkoutBtn.addEventListener("click", function() {
    if (cart.length === 0) {
        alert(
            currentLanguage === "ar"
                ? "السلة فارغة! أضف منتج أولاً."
                : "Your cart is empty! Add a product first."
        );
        return;
    }

    checkoutForm.style.display = "flex";

    checkoutForm.scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

// ======================================
// WHATSAPP CHECKOUT
// ======================================

checkoutForm.addEventListener("submit", function(event) {
    event.preventDefault();

    if (cart.length === 0) {
        alert(
            currentLanguage === "ar"
                ? "السلة فارغة!"
                : "Your cart is empty!"
        );
        return;
    }

    const customerName =
        document.getElementById("customerName").value.trim();

    const customerPhone =
        document.getElementById("customerPhone").value.trim();

    const customerAddress =
        document.getElementById("customerAddress").value.trim();

    let total = 0;
    let productsMessage = "";

    // The order message is always in Arabic, the store owner's language
    cart.forEach(function(item) {
        const itemTotal = item.price * item.quantity;
        total += itemTotal;

        productsMessage +=
            `\n- ${item.nameAr} × ${item.quantity} = ${itemTotal.toLocaleString("en-US")} EGP`;
    });

    const message = `
طلب جديد من NOIRÉ

اسم العميل: ${customerName}

رقم الهاتف: ${customerPhone}

العنوان: ${customerAddress}

المنتجات:
${productsMessage}

الإجمالي: ${total.toLocaleString("en-US")} EGP

شكراً لاختيارك NOIRÉ
`;

    const whatsappLink =
        `https://wa.me/${storeWhatsApp}?text=${encodeURIComponent(message)}`;

    // Some phones (iPhone) block window.open: fall back to opening in the same tab
    const opened = window.open(whatsappLink, "_blank");

    if (!opened) {
        window.location.href = whatsappLink;
    }

    // Order sent: reset the cart and the form
    cart = [];
    renderCart();
    checkoutForm.reset();
    checkoutForm.style.display = "none";
});

// ======================================
// INITIALIZE STORE
// ======================================

renderCart();
getProducts();