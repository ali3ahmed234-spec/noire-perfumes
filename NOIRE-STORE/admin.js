// ===============================
// SUPABASE CONNECTION
// ===============================

const SUPABASE_URL = "https://pikbxycwvqfjxncjlzrf.supabase.co";

const SUPABASE_KEY = "sb_publishable_-Q7fUiauwtRFP7xfS6dv7w_mxWR7Qjx";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


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


// ===============================
// SHOW LOGIN / DASHBOARD
// ===============================

function showLogin(message = "") {
    adminLogin.style.display = "block";
    dashboardContent.style.display = "none";
    loginMessage.textContent = message;
}

function showDashboard() {
    adminLogin.style.display = "none";
    dashboardContent.style.display = "block";
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

    const email = document.getElementById("loginEmail").value;
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

    showLogin("تم تسجيل الخروج بنجاح.");

});


// ===============================
// IMAGE PREVIEW
// ===============================

productImage.addEventListener("change", function () {

    const file = productImage.files[0];

    if (!file) {
        imagePreview.src = "";
        imagePreview.style.display = "none";
        return;
    }

    if (!file.type.startsWith("image/")) {
        alert("من فضلك اختر ملف صورة صحيح.");
        productImage.value = "";
        imagePreview.src = "";
        imagePreview.style.display = "none";
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.");
        productImage.value = "";
        imagePreview.src = "";
        imagePreview.style.display = "none";
        return;
    }

    const imageURL = URL.createObjectURL(file);

    imagePreview.src = imageURL;
    imagePreview.style.display = "block";

});


// ===============================
// UPLOAD IMAGE TO SUPABASE
// ===============================

async function uploadProductImage(file) {

    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error("نوع الصورة غير مدعوم. استخدم JPG أو PNG أو WEBP.");
    }

    if (file.size > 5 * 1024 * 1024) {
        throw new Error("حجم الصورة أكبر من 5 ميجابايت.");
    }

    const extension = file.type.split("/")[1];

    const fileName =
        Date.now() + "-" +
        Math.random().toString(36).substring(2, 10) +
        "." + extension;

    const filePath = fileName;

    const { error } = await supabaseClient
        .storage
        .from("product-images")
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
        .from("product-images")
        .getPublicUrl(filePath);

    return data.publicUrl;

}


// ===============================
// LOAD PRODUCTS
// ===============================

async function loadProducts() {

    adminProducts.textContent = "جاري تحميل المنتجات...";

    const { data, error } = await supabaseClient
        .from("products")
        .select("*")
        .order("created_at", { ascending: true });

    if (error) {
        console.error(error);
        adminProducts.textContent = "حدث خطأ أثناء تحميل المنتجات.";
        return;
    }

    displayProducts(data);

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

        image.onerror = function () {
            image.style.display = "none";
        };

        const info = document.createElement("div");

        const name = document.createElement("h3");
        name.textContent = product.name_ar;

        const price = document.createElement("p");
        price.textContent =
            Number(product.price).toLocaleString("en-US") + " EGP";

        info.appendChild(name);
        info.appendChild(price);

        const buttons = document.createElement("div");

        const editButton = document.createElement("button");
        editButton.textContent = "تعديل";

        editButton.addEventListener("click", function () {
            editProduct(product);
        });

        const deleteButton = document.createElement("button");
        deleteButton.textContent = "حذف";

        deleteButton.addEventListener("click", function () {
            deleteProduct(product.id);
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

    try {

        // Upload image
        const imageURL = await uploadProductImage(file);

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
            throw error;
        }

        alert("تم رفع الصورة وإضافة المنتج بنجاح!");

        productForm.reset();

        imagePreview.src = "";
        imagePreview.style.display = "none";

        await loadProducts();

    } catch (error) {

        console.error(error);
        alert("حدث خطأ: " + error.message);

    } finally {

        submitButton.disabled = false;
        submitButton.textContent = "إضافة المنتج";

    }

});


// ===============================
// EDIT PRODUCT
// ===============================

async function editProduct(product) {

    const newNameAr = prompt("اسم المنتج بالعربي:", product.name_ar);
    if (newNameAr === null) return;

    const newName = prompt("اسم المنتج بالإنجليزي:", product.name);
    if (newName === null) return;

    const newPrice = prompt("السعر:", product.price);
    if (newPrice === null) return;

    const newDescriptionAr = prompt(
        "الوصف بالعربي:",
        product.description_ar || ""
    );

    if (newDescriptionAr === null) return;

    const newDescription = prompt(
        "الوصف بالإنجليزي:",
        product.description || ""
    );

    if (newDescription === null) return;

    const priceNumber = Number(newPrice);

    if (
        !newNameAr.trim() ||
        !newName.trim() ||
        !Number.isFinite(priceNumber) ||
        priceNumber <= 0
    ) {
        alert("تأكد من إدخال البيانات بشكل صحيح.");
        return;
    }

    const { error } = await supabaseClient
        .from("products")
        .update({
            name_ar: newNameAr.trim(),
            name: newName.trim(),
            price: priceNumber,
            description_ar: newDescriptionAr.trim(),
            description: newDescription.trim()
        })
        .eq("id", product.id);

    if (error) {
        console.error(error);
        alert("حدث خطأ أثناء تعديل المنتج.");
        return;
    }

    alert("تم تعديل المنتج بنجاح!");

    await loadProducts();

}


// ===============================
// DELETE PRODUCT
// ===============================

async function deleteProduct(id) {

    const confirmDelete = confirm(
        "هل أنت متأكد أنك تريد حذف هذا المنتج؟"
    );

    if (!confirmDelete) return;

    const { error } = await supabaseClient
        .from("products")
        .delete()
        .eq("id", id);

    if (error) {
        console.error(error);
        alert("حدث خطأ أثناء حذف المنتج.");
        return;
    }

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