// ===============================
// SUPABASE CONNECTION
// ===============================

const SUPABASE_URL = "https://pikbxycwvqfjxncjlzrf.supabase.co";

const SUPABASE_KEY = "sb_publishable_-Q7fUiauwtRFP7xfS6dv7w_mxWR7Qjx";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const STORAGE_BUCKET = "product-images";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_ORIGINAL_SIZE = 15 * 1024 * 1024; // before compression
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;    // after compression


// ===============================
// HTML ELEMENTS
// ===============================

const adminLogin = document.getElementById("adminLogin");
const dashboardContent = document.getElementById("dashboardContent");

const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("loginMessage");
const loginButton = document.getElementById("loginButton");

const logoutBtn = document.getElementById("logoutBtn");

const productForm = document.getElementById("productForm");
const adminProducts = document.getElementById("adminProducts");
const productCount = document.getElementById("productCount");

const productImage = document.getElementById("productImage");
const imagePreview = document.getElementById("imagePreview");

const editModal = document.getElementById("editModal");
const editForm = document.getElementById("editForm");
const editNameAr = document.getElementById("editNameAr");
const editName = document.getElementById("editName");
const editPrice = document.getElementById("editPrice");
const editDescriptionAr = document.getElementById("editDescriptionAr");
const editDescription = document.getElementById("editDescription");
const editImage = document.getElementById("editImage");
const editImagePreview = document.getElementById("editImagePreview");
const editSaveBtn = document.getElementById("editSaveBtn");
const editCancelBtn = document.getElementById("editCancelBtn");

let editingProduct = null;


// ===============================
// SHOW LOGIN / DASHBOARD
// ===============================

function showLogin(message = "") {
    adminLogin.style.display = "block";
    dashboardContent.style.display = "none";
    logoutBtn.style.display = "none";
    loginMessage.textContent = message;
}

function showDashboard() {
    adminLogin.style.display = "none";
    dashboardContent.style.display = "block";
    logoutBtn.style.display = "";
}


// ===============================
// VERIFY ADMIN
// ===============================

async function verifyAdmin(user) {

    const { data, error } = await supabaseClient
        .from("admins")
        .select("user_id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (error) {
        console.error(error);
        showLogin("حدث خطأ أثناء التحقق من صلاحيات المدير.");
        return;
    }

    if (!data) {
        await supabaseClient.auth.signOut();
        showLogin("هذا الحساب ليس لديه صلاحية دخول لوحة التحكم.");
        return;
    }

    showDashboard();
    await loadProducts();
}


// ===============================
// LOGIN
// ===============================

loginForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    loginButton.disabled = true;
    loginButton.textContent = "جاري تسجيل الدخول...";

    const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email,
        password: password
    });

    loginButton.disabled = false;
    loginButton.textContent = "تسجيل الدخول";

    if (error) {
        console.error(error);
        loginMessage.textContent = "البريد الإلكتروني أو كلمة المرور غير صحيحة.";
        return;
    }

    await verifyAdmin(data.user);

});


// ===============================
// LOGOUT
// ===============================

logoutBtn.addEventListener("click", async function () {

    const { error } = await supabaseClient.auth.signOut();

    if (error) {
        alert("حدث خطأ أثناء تسجيل الخروج.");
        return;
    }

    closeEditModal();
    showLogin("تم تسجيل الخروج بنجاح.");

});


// ===============================
// IMAGE HELPERS
// ===============================

function resetPreview(input, preview) {
    input.value = "";
    preview.src = "";
    preview.style.display = "none";
}

// Validates the chosen file and shows a preview. Returns true if accepted.
function handleImageChoice(input, preview) {

    const file = input.files[0];

    if (!file) {
        resetPreview(input, preview);
        return false;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        alert("نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.");
        resetPreview(input, preview);
        return false;
    }

    if (file.size > MAX_ORIGINAL_SIZE) {
        alert("حجم الصورة كبير جداً. اختر صورة أصغر من 15 ميجابايت.");
        resetPreview(input, preview);
        return false;
    }

    preview.src = URL.createObjectURL(file);
    preview.style.display = "block";
    return true;

}

// Shrinks big phone photos (max 1200px, WEBP) before upload.
// If anything fails, the original file is used.
function compressImage(file) {

    return new Promise(function (resolve) {

        const MAX_SIDE = 1200;
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = function () {

            try {

                let width = img.naturalWidth;
                let height = img.naturalHeight;

                if (width > MAX_SIDE || height > MAX_SIDE) {
                    const ratio = Math.min(MAX_SIDE / width, MAX_SIDE / height);
                    width = Math.round(width * ratio);
                    height = Math.round(height * ratio);
                }

                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;

                canvas.getContext("2d").drawImage(img, 0, 0, width, height);

                canvas.toBlob(function (blob) {

                    URL.revokeObjectURL(url);

                    if (blob && blob.type === "image/webp" && blob.size < file.size) {
                        resolve(blob);
                    } else {
                        resolve(file);
                    }

                }, "image/webp", 0.82);

            } catch (err) {
                URL.revokeObjectURL(url);
                resolve(file);
            }

        };

        img.onerror = function () {
            URL.revokeObjectURL(url);
            resolve(file);
        };

        img.src = url;

    });

}

productImage.addEventListener("change", function () {
    handleImageChoice(productImage, imagePreview);
});

editImage.addEventListener("change", function () {
    handleImageChoice(editImage, editImagePreview);
});


// ===============================
// UPLOAD / REMOVE IMAGE IN SUPABASE
// ===============================

async function uploadProductImage(originalFile) {

    if (!ALLOWED_IMAGE_TYPES.includes(originalFile.type)) {
        throw new Error("نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.");
    }

    const file = await compressImage(originalFile);

    if (file.size > MAX_UPLOAD_SIZE) {
        throw new Error("حجم الصورة أكبر من 5 ميجابايت حتى بعد الضغط.");
    }

    const extension = file.type.split("/")[1];

    const filePath =
        Date.now() + "-" +
        Math.random().toString(36).substring(2, 10) +
        "." + extension;

    const { error } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
            contentType: file.type
        });

    if (error) {
        throw error;
    }

    const { data } = supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(filePath);

    return data.publicUrl;

}

// Best effort: deletes an old image from storage. Never blocks the main action.
async function removeStoredImage(imageUrl) {

    try {

        if (!imageUrl) return;

        const marker = "/" + STORAGE_BUCKET + "/";
        const index = imageUrl.indexOf(marker);

        if (index === -1) return;

        const path = decodeURIComponent(
            imageUrl.slice(index + marker.length).split("?")[0]
        );

        const { error } = await supabaseClient
            .storage
            .from(STORAGE_BUCKET)
            .remove([path]);

        if (error) {
            console.error("Could not remove old image:", error);
        }

    } catch (err) {
        console.error("Could not remove old image:", err);
    }

}


// ===============================
// LOAD PRODUCTS
// ===============================

async function loadProducts() {

    adminProducts.textContent = "جاري تحميل المنتجات...";

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        console.error(error);
        adminProducts.textContent = "حدث خطأ أثناء تحميل المنتجات.";
        return;
    }

    displayProducts(data || []);

}


// ===============================
// DISPLAY PRODUCTS
// ===============================

function displayProducts(products) {

    adminProducts.innerHTML = "";

    productCount.textContent = products.length;

    if (products.length === 0) {
        adminProducts.textContent = "لا توجد منتجات حالياً.";
        return;
    }

    products.forEach(function (product) {

        const productDiv = document.createElement("div");
        productDiv.className = "admin-product";

        const image = document.createElement("img");
        image.src = product.image || "";
        image.alt = product.name || "Product";
        image.loading = "lazy";

        image.onerror = function () {
            image.style.visibility = "hidden";
        };

        const info = document.createElement("div");
        info.className = "admin-product-info";

        const name = document.createElement("h3");
        name.textContent = product.name_ar || product.name || "";

        const price = document.createElement("p");
        price.textContent =
            Number(product.price).toLocaleString("en-US") + " EGP";

        info.appendChild(name);
        info.appendChild(price);

        const buttons = document.createElement("div");
        buttons.className = "admin-product-actions";

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "تعديل";

        editButton.addEventListener("click", function () {
            openEditModal(product);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-btn";
        deleteButton.textContent = "حذف";

        deleteButton.addEventListener("click", function () {
            deleteProduct(product);
        });

        buttons.appendChild(editButton);
        buttons.appendChild(deleteButton);

        productDiv.appendChild(image);
        productDiv.appendChild(info);
        productDiv.appendChild(buttons);

        adminProducts.appendChild(productDiv);

    });

}


// ===============================
// ADD PRODUCT
// ===============================

productForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    const submitButton = productForm.querySelector(
        'button[type="submit"]'
    );

    const nameAr = document.getElementById("productNameAr").value.trim();
    const name = document.getElementById("productName").value.trim();

    const price = Number(
        document.getElementById("productPrice").value
    );

    const descriptionAr =
        document.getElementById("productDescriptionAr").value.trim();

    const description =
        document.getElementById("productDescription").value.trim();

    const file = productImage.files[0];

    if (!nameAr || !name || !file || !Number.isFinite(price) || price <= 0) {
        alert("من فضلك أكمل بيانات المنتج واختر صورة صحيحة.");
        return;
    }

    submitButton.disabled = true;
    submitButton.textContent = "جاري رفع الصورة وإضافة المنتج...";

    let imageURL = null;

    try {

        // Upload image
        imageURL = await uploadProductImage(file);

        // Insert product
        const newProduct = {
            name_ar: nameAr,
            name: name,
            price: price,
            description_ar: descriptionAr,
            description: description,
            image: imageURL
        };

        const { error } = await supabaseClient
            .from("products")
            .insert([newProduct]);

        if (error) {
            // Don't leave an orphan image behind
            await removeStoredImage(imageURL);
            throw error;
        }

        alert("تم رفع الصورة وإضافة المنتج بنجاح!");

        productForm.reset();
        resetPreview(productImage, imagePreview);

        await loadProducts();

    } catch (error) {

        console.error(error);
        alert("حدث خطأ: " + (error.message || "حاول مرة أخرى."));

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = "إضافة المنتج";

    }

});


// ===============================
// EDIT PRODUCT (MODAL)
// ===============================

function openEditModal(product) {

    editingProduct = product;

    editNameAr.value = product.name_ar || "";
    editName.value = product.name || "";
    editPrice.value = product.price;
    editDescriptionAr.value = product.description_ar || "";
    editDescription.value = product.description || "";

    editImage.value = "";

    if (product.image) {
        editImagePreview.src = product.image;
        editImagePreview.style.display = "block";
    } else {
        editImagePreview.src = "";
        editImagePreview.style.display = "none";
    }

    editModal.style.display = "flex";
    editNameAr.focus();

}

function closeEditModal() {
    editingProduct = null;
    editModal.style.display = "none";
    editImage.value = "";
}

editCancelBtn.addEventListener("click", closeEditModal);

editModal.addEventListener("click", function (event) {
    if (event.target === editModal) {
        closeEditModal();
    }
});

document.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && editModal.style.display !== "none") {
        closeEditModal();
    }
});

editForm.addEventListener("submit", async function (e) {

    e.preventDefault();

    if (!editingProduct) return;

    const product = editingProduct;

    const priceNumber = Number(editPrice.value);

    if (
        !editNameAr.value.trim() ||
        !editName.value.trim() ||
        !Number.isFinite(priceNumber) ||
        priceNumber <= 0
    ) {
        alert("تأكد من إدخال البيانات بشكل صحيح.");
        return;
    }

    editSaveBtn.disabled = true;
    editSaveBtn.textContent = "جاري الحفظ...";

    let newImageURL = null;

    try {

        const updates = {
            name_ar: editNameAr.value.trim(),
            name: editName.value.trim(),
            price: priceNumber,
            description_ar: editDescriptionAr.value.trim(),
            description: editDescription.value.trim()
        };

        const newFile = editImage.files[0];

        if (newFile) {
            newImageURL = await uploadProductImage(newFile);
            updates.image = newImageURL;
        }

        const { error } = await supabaseClient
            .from("products")
            .update(updates)
            .eq("id", product.id);

        if (error) {
            if (newImageURL) {
                await removeStoredImage(newImageURL);
            }
            throw error;
        }

        // The new image is saved, so the old one is no longer needed
        if (newImageURL) {
            await removeStoredImage(product.image);
        }

        alert("تم تعديل المنتج بنجاح!");

        closeEditModal();
        await loadProducts();

    } catch (error) {

        console.error(error);
        alert("حدث خطأ أثناء تعديل المنتج: " + (error.message || "حاول مرة أخرى."));

    } finally {

        editSaveBtn.disabled = false;
        editSaveBtn.textContent = "حفظ التعديلات";

    }

});


// ===============================
// DELETE PRODUCT
// ===============================

async function deleteProduct(product) {

    const confirmDelete = confirm(
        "هل أنت متأكد أنك تريد حذف هذا المنتج؟"
    );

    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", product.id);

    if (error) {
        console.error(error);
        alert("حدث خطأ أثناء حذف المنتج.");
        return;
    }

    await removeStoredImage(product.image);

    alert("تم حذف المنتج بنجاح!");

    await loadProducts();

}


// ===============================
// CHECK EXISTING SESSION
// ===============================

async function initializeAdmin() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error(error);
        showLogin("تعذر التحقق من جلسة تسجيل الدخول.");
        return;
    }

    if (data.session && data.session.user) {
        await verifyAdmin(data.session.user);
    } else {
        showLogin();
    }

}

initializeAdmin();