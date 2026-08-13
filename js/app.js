// State Management
let farmConfig = { ...defaultFarmConfig };
let apiBaseUrl = window.location.origin;
let currentAdminPin = null; // Holds verified PIN in session memory

// Initialize App
document.addEventListener("DOMContentLoaded", async () => {
    await fetchBackendConfig();
    setupCalculator();
    setupAdminAuth();
    setupCustomizer();
    applyFarmConfig();
});

// Fetch Farm Config from REST API (/api/config)
async function fetchBackendConfig() {
    try {
        const res = await fetch(`${apiBaseUrl}/api/config`);
        if (res.ok) {
            const result = await res.json();
            if (result.success && result.data) {
                farmConfig = { ...defaultFarmConfig, ...result.data };
            }
        }
    } catch (e) {
        console.log("API offline, using local/default config", e);
        const saved = localStorage.getItem("poultry_farm_config");
        if (saved) {
            try { farmConfig = { ...defaultFarmConfig, ...JSON.parse(saved) }; } catch(e) {}
        }
    }
}

// Apply Farm Config dynamically across DOM
function applyFarmConfig() {
    // Farm Name Text & Attributes
    document.querySelectorAll(".dyn-farm-name").forEach(el => el.textContent = farmConfig.farmName);
    document.querySelectorAll(".dyn-tagline").forEach(el => el.textContent = farmConfig.tagline);
    document.querySelectorAll(".dyn-address").forEach(el => el.textContent = farmConfig.address);
    document.querySelectorAll(".dyn-hours").forEach(el => el.textContent = farmConfig.hours);
    
    // Phone 1 & 2 Text & Links
    document.querySelectorAll(".dyn-phone-1-text").forEach(el => el.textContent = farmConfig.phone1);
    document.querySelectorAll(".dyn-phone-1-link").forEach(el => {
        el.href = `tel:${farmConfig.phone1.replace(/\s+/g, '')}`;
    });
    
    document.querySelectorAll(".dyn-phone-2-text").forEach(el => el.textContent = farmConfig.phone2 || farmConfig.phone1);
    document.querySelectorAll(".dyn-phone-2-link").forEach(el => {
        el.href = `tel:${(farmConfig.phone2 || farmConfig.phone1).replace(/\s+/g, '')}`;
    });

    const cleanWaNum = farmConfig.whatsapp.replace(/\D/g, '');

    // Instagram Link Binding
    const instaUrl = farmConfig.instagramUrl || "https://www.instagram.com/kadak_farms_vizianagaram";
    document.querySelectorAll(".dyn-instagram-link").forEach(el => {
        el.href = instaUrl;
        el.target = "_blank";
    });

    // General WhatsApp Links
    document.querySelectorAll(".dyn-whatsapp-link").forEach(el => {
        const defaultMsg = encodeURIComponent(`Hello ${farmConfig.farmName}! I would like to inquire about your fresh eggs and chicks.`);
        el.href = `https://wa.me/${cleanWaNum}?text=${defaultMsg}`;
        el.target = "_blank";
    });

    // Chick Direct WhatsApp Button Link
    document.querySelectorAll(".dyn-chick-wa-link").forEach(el => {
        const chickMsg = encodeURIComponent(`Hello ${farmConfig.farmName}! I would like to order Kadaknath Chicks (1 to 6 Months Age Group). Please share availability and batch details.`);
        el.href = `https://wa.me/${cleanWaNum}?text=${chickMsg}`;
        el.target = "_blank";
    });

    // Egg Direct WhatsApp Button Link
    document.querySelectorAll(".dyn-egg-wa-link").forEach(el => {
        const eggMsg = encodeURIComponent(`Hello ${farmConfig.farmName}! I would like to order Kadaknath Eggs. Please share tray availability and delivery timelines.`);
        el.href = `https://wa.me/${cleanWaNum}?text=${eggMsg}`;
        el.target = "_blank";
    });

    // Meat Chicken Direct WhatsApp Button Link
    document.querySelectorAll(".dyn-meat-wa-link").forEach(el => {
        const meatMsg = encodeURIComponent(`Hello ${farmConfig.farmName}! I would like to order Kadaknath Whole Live Chicken (For Meat - Starting 1.2kg & above at ₹1,500/kg). Please share available bird weights.`);
        el.href = `https://wa.me/${cleanWaNum}?text=${meatMsg}`;
        el.target = "_blank";
    });

    // Google Maps Direct Link Binding
    const mapUrl = farmConfig.mapEmbedUrl || "https://www.google.com/maps?q=18.056419372558594,83.3743667602539&z=17&hl=en";
    document.querySelectorAll(".dyn-map-link").forEach(el => {
        el.href = mapUrl;
        el.target = "_blank";
    });
}

// Order & Cost Calculator Logic
function setupCalculator() {
    const selectProduct = document.getElementById("calc-product");
    const inputQty = document.getElementById("calc-qty");
    const totalDisplay = document.getElementById("calc-total-display");
    const breakdownDisplay = document.getElementById("calc-breakdown-display");
    const waCalcBtn = document.getElementById("calc-wa-btn");

    if (!selectProduct || !inputQty || !totalDisplay) return;

    const recalculate = () => {
        const selectedOpt = selectProduct.options[selectProduct.selectedIndex];
        if (!selectedOpt) return;
        const price = parseFloat(selectedOpt.getAttribute("data-price")) || 0;
        const unitName = selectedOpt.getAttribute("data-unit") || "units";
        const productName = selectedOpt.getAttribute("data-name") || "Product";
        const qty = parseInt(inputQty.value) || 1;

        const totalCost = price * qty;

        totalDisplay.textContent = `₹${totalCost.toLocaleString('en-IN')}`;
        breakdownDisplay.textContent = `${qty} ${unitName} × ₹${price} per unit`;

        // Update WhatsApp Order Button
        const cleanWaNum = farmConfig.whatsapp.replace(/\D/g, '');
        const msg = encodeURIComponent(`Hello ${farmConfig.farmName}! I calculated an order estimate on your website:\n\nProduct: ${productName}\nQuantity: ${qty} ${unitName}\nEstimated Total: ₹${totalCost.toLocaleString('en-IN')}\n\nPlease confirm availability and delivery timelines.`);
        waCalcBtn.href = `https://wa.me/${cleanWaNum}?text=${msg}`;
    };

    selectProduct.addEventListener("change", recalculate);
    inputQty.addEventListener("input", recalculate);
    recalculate(); // Initial call
}

// ADMIN AUTHENTICATION LOGIN LOGIC
function setupAdminAuth() {
    const loginModal = document.getElementById("admin-login-modal");
    const openBtns = document.querySelectorAll(".open-customizer-btn");
    const loginForm = document.getElementById("admin-login-form");
    const cancelBtn = document.getElementById("admin-login-cancel-btn");
    const pinError = document.getElementById("admin-pin-error");

    openBtns.forEach(btn => {
        btn.addEventListener("click", (e) => {
            e.preventDefault();
            // If already authenticated in current session, open customizer directly
            if (currentAdminPin) {
                openCustomizerModal();
                return;
            }

            // Otherwise prompt for Admin PIN
            const pinInput = document.getElementById("admin-pin-input");
            if (pinInput) pinInput.value = "";
            if (pinError) pinError.style.display = "none";
            if (loginModal) loginModal.classList.add("open");
        });
    });

    if (cancelBtn) {
        cancelBtn.addEventListener("click", () => loginModal.classList.remove("open"));
    }

    if (loginModal) {
        loginModal.addEventListener("click", (e) => {
            if (e.target === loginModal) loginModal.classList.remove("open");
        });
    }

    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const pin = document.getElementById("admin-pin-input").value.trim();

            try {
                const res = await fetch(`${apiBaseUrl}/api/admin/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pin })
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.success) {
                        currentAdminPin = pin;
                        loginModal.classList.remove("open");
                        openCustomizerModal();
                        return;
                    }
                }
            } catch (err) {
                console.error("Backend auth check error, testing fallback PIN", err);
                if (pin === "1234") {
                    currentAdminPin = pin;
                    loginModal.classList.remove("open");
                    openCustomizerModal();
                    return;
                }
            }

            if (pinError) {
                pinError.style.display = "block";
                pinError.textContent = "❌ Invalid Admin PIN. Access Denied.";
            }
        });
    }
}

// Open Business Details Modal (After Admin Auth Success)
function openCustomizerModal() {
    const modal = document.getElementById("customizer-modal");
    if (!modal) return;
    document.getElementById("cust-farm-name").value = farmConfig.farmName;
    document.getElementById("cust-tagline").value = farmConfig.tagline;
    document.getElementById("cust-phone1").value = farmConfig.phone1;
    document.getElementById("cust-phone2").value = farmConfig.phone2;
    document.getElementById("cust-whatsapp").value = farmConfig.whatsapp;
    document.getElementById("cust-address").value = farmConfig.address;
    document.getElementById("cust-hours").value = farmConfig.hours;
    document.getElementById("cust-new-pin").value = "";
    modal.classList.add("open");
}

// Live Farm Customizer Form Logic
function setupCustomizer() {
    const modal = document.getElementById("customizer-modal");
    const closeBtn = document.getElementById("customizer-close-btn");
    const form = document.getElementById("customizer-form");

    if (closeBtn && modal) {
        closeBtn.addEventListener("click", () => modal.classList.remove("open"));
    }

    if (modal) {
        modal.addEventListener("click", (e) => {
            if (e.target === modal) modal.classList.remove("open");
        });
    }

    if (form) {
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const newPin = document.getElementById("cust-new-pin").value.trim();

            const updatedConfig = {
                adminPin: currentAdminPin,
                newAdminPin: newPin || undefined,
                farmName: document.getElementById("cust-farm-name").value.trim() || defaultFarmConfig.farmName,
                tagline: document.getElementById("cust-tagline").value.trim() || defaultFarmConfig.tagline,
                phone1: document.getElementById("cust-phone1").value.trim() || defaultFarmConfig.phone1,
                phone2: document.getElementById("cust-phone2").value.trim() || defaultFarmConfig.phone2,
                whatsapp: document.getElementById("cust-whatsapp").value.trim() || defaultFarmConfig.whatsapp,
                address: document.getElementById("cust-address").value.trim() || defaultFarmConfig.address,
                hours: document.getElementById("cust-hours").value.trim() || defaultFarmConfig.hours,
                mapEmbedUrl: defaultFarmConfig.mapEmbedUrl
            };

            // Post updated config to REST API (/api/config)
            try {
                const res = await fetch(`${apiBaseUrl}/api/config`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'X-Admin-PIN': currentAdminPin
                    },
                    body: JSON.stringify(updatedConfig)
                });

                if (res.ok) {
                    const data = await res.json();
                    if (data.data) farmConfig = data.data;
                    if (newPin) currentAdminPin = newPin; // update session pin if changed
                } else {
                    const errData = await res.json();
                    alert("Unauthorized: " + (errData.error || "Invalid PIN"));
                    return;
                }
            } catch (err) {
                console.error("Backend config save error", err);
                farmConfig = updatedConfig;
                localStorage.setItem("poultry_farm_config", JSON.stringify(farmConfig));
            }

            applyFarmConfig();
            setupCalculator();
            if (modal) modal.classList.remove("open");
            alert("✅ Business details updated successfully by Administrator!");
        });
    }
}

