document.addEventListener('DOMContentLoaded', async function() {
    // --- SUPABASE CLIENT SETUP ---
    const SUPABASE_URL = 'https://ljdocufdxpvexpdtvdvs.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqZG9jdWZkeHB2ZXhwZHR2ZHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA3MDI2ODIsImV4cCI6MjA3NjI3ODY4Mn0.gxmkz4zReDLcX9uqcs6kE030IQHubz7OVxBDaCviHjc';
    // Ensure supabase object is available globally from the CDN script
    if (typeof supabase === 'undefined') {
        console.error('Supabase library not loaded. Ensure the CDN script tag is present in your HTML.');
        return;
    }
    const { createClient } = supabase;
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // --- INITIAL SETUP ---
    feather.replace(); // Load icons immediately
    updateCartDisplay(); // Update cart display immediately

    // --- AUTHENTICATION ---
    try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error) throw error;
        updateHeader(session?.user);

        supabaseClient.auth.onAuthStateChange((_event, session) => {
            updateHeader(session?.user);
        });
    } catch (error) {
        console.error("Error checking authentication status:", error);
        // Display login state as default if auth check fails
        updateHeader(null);
    }


    // --- PAGE-SPECIFIC LOGIC ROUTER ---
    // Check for unique IDs or elements on each page to determine which functions to run
    if (document.getElementById('accordion-container')) loadProducts();
    if (document.getElementById('product-page-container')) loadProduct();
    if (document.getElementById('cart-items')) setupCartPage();
    if (document.getElementById('auth-form')) setupAuthPage();
    if (document.getElementById('orders-list')) setupOrdersPage();
    if (document.getElementById('order-number') && document.querySelector('h1')?.textContent.includes('Confirmation')) setupConfirmationPage(); // More specific check
    if (document.getElementById('premium-accordion-container')) loadPremiumProducts(); // Added premium page check
    if (document.getElementById('agent-product-container')) setupAgentPage(); // Added agent page check


    // --- UNIVERSAL FUNCTIONS ---
    function updateHeader(user) {
        const authContainer = document.getElementById('auth-links-container');
        if (!authContainer) {
             console.warn("Auth links container not found."); // Warning if element is missing
             return;
        }
        if (user) {
            // User is logged in
            authContainer.innerHTML = `
                <span class="text-sm text-gray-600 mr-4">${user.email}</span>
                <button id="logout-button" class="text-gray-500 hover:text-red-500 p-1" title="Logout">
                    <i data-feather="log-out" class="h-5 w-5 pointer-events-none"></i>
                </button>
            `;
            const logoutButton = document.getElementById('logout-button');
             if(logoutButton) {
                 logoutButton.addEventListener('click', async () => {
                    try {
                        const { error } = await supabaseClient.auth.signOut();
                        if (error) throw error;
                        window.location.href = 'index.html'; // Redirect to home after logout
                    } catch (error) {
                        console.error("Logout failed:", error);
                        alert("Logout failed. Please try again.");
                    }
                 });
             }
        } else {
            // User is logged out
            authContainer.innerHTML = `
                <a href="login.html" class="flex items-center text-gray-700 hover:text-gray-900 p-1" title="Login/Register">
                    <i data-feather="user" class="h-5 w-5"></i>
                </a>
            `;
        }
        feather.replace(); // Redraw icons after updating HTML
    }

    function updateCartDisplay() {
        try {
            const cart = JSON.parse(localStorage.getItem('datadeals-cart')) || [];
            let totalItems = 0;
            let totalPrice = 0;
            cart.forEach(item => {
                // Add checks for valid item structure
                if (item && typeof item.quantity === 'number' && typeof item.price === 'number') {
                    totalItems += item.quantity;
                    totalPrice += item.price * item.quantity;
                } else {
                    console.warn("Invalid item found in cart:", item);
                }
            });

            const cartBadge = document.querySelector('.cart-badge');
            if (cartBadge) {
                if (totalItems > 0) {
                    cartBadge.textContent = totalItems;
                    cartBadge.classList.remove('hidden');
                } else {
                    cartBadge.classList.add('hidden');
                }
            }
            const cartTotalElement = document.getElementById('cart-total-header');
            if (cartTotalElement) {
                cartTotalElement.textContent = `₵${totalPrice.toFixed(2)}`;
            }
        } catch (e) {
            console.error("Error updating cart display:", e);
            localStorage.removeItem('datadeals-cart'); // Clear corrupted cart data
        }
    }

    // --- STORE PAGE FUNCTIONS ---
    async function loadProducts() {
        const container = document.getElementById('accordion-container');
        if (!container) return;
        container.innerHTML = '<p class="text-center text-gray-500">Loading products...</p>';
        try {
            const { data: products, error } = await supabaseClient.from('products').select('*').order('name');
            if (error) throw error;
            if (!products || products.length === 0) {
                 container.innerHTML = '<p class="text-center text-gray-500">No products available at this time.</p>';
                 return;
            }
            container.innerHTML = ''; // Clear loading message
            products.forEach(product => container.innerHTML += createProductHTML(product));
            feather.replace(); // Initialize icons
            setupAccordion(); // Attach event listeners
        } catch (error) {
            console.error('Error fetching products:', error);
            container.innerHTML = '<p class="text-center text-red-500">Could not load products. Please try refreshing the page.</p>';
        }
    }
    function createProductHTML(product) {
        // Basic validation for packages
        if (!Array.isArray(product.packages) || product.packages.length === 0 || !product.packages[0].price || !product.packages[product.packages.length - 1].price) {
            console.warn(`Product "${product.name}" has invalid package data. Skipping price range.`);
            return `<div>Error loading product: ${product.name}</div>`; // Prevent rendering broken product
        }
        const priceRange = `₵${product.packages[0].price.toFixed(2)} – ₵${product.packages[product.packages.length - 1].price.toFixed(2)}`;
        return `
            <div class="mb-4">
                <div class="accordion-header p-4 text-white cursor-pointer flex justify-between items-center rounded-lg">
                    <h2 class="text-xl font-bold">${product.name}</h2>
                    <i data-feather="chevron-down" class="h-5 w-5"></i>
                </div>
                <div class="accordion-content bg-white p-6 rounded-b-lg shadow-sm hidden">
                    <div class="flex items-center">
                        <img class="h-16 w-16 object-contain rounded-md mr-4" src="${product.image_url || 'placeholder.png'}" alt="${product.name}">
                        <div>
                            <p class="text-lg font-semibold">${product.name} Data</p>
                            <p class="text-gray-600 mt-1">${priceRange}</p>
                        </div>
                    </div>
                    <div class="mt-4">
                        <a href="product.html?product=${encodeURIComponent(product.name.toLowerCase())}" class="w-full block bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition text-center">
                            Select options
                        </a>
                    </div>
                </div>
            </div>`;
    }
    function setupAccordion() {
        document.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', () => {
                const content = header.nextElementSibling;
                if (!content) return;
                // Close others
                document.querySelectorAll('.accordion-content').forEach(otherContent => {
                    if (otherContent !== content && !otherContent.classList.contains('hidden')) {
                        otherContent.classList.add('hidden');
                        const otherIcon = otherContent.previousElementSibling.querySelector('i');
                        if (otherIcon) otherIcon.setAttribute('data-feather', 'chevron-down');
                    }
                });
                // Toggle clicked
                content.classList.toggle('hidden');
                const icon = header.querySelector('i');
                if (icon) icon.setAttribute('data-feather', content.classList.contains('hidden') ? 'chevron-down' : 'chevron-up');
                feather.replace();
            });
        });
    }

    // --- PRODUCT PAGE FUNCTIONS ---
    async function loadProduct() {
        const container = document.getElementById('product-page-container');
        if (!container) return;
        container.innerHTML = '<p class="text-center text-gray-500">Loading product...</p>';
        const params = new URLSearchParams(window.location.search);
        const productName = params.get('product');
        if (!productName) { window.location.href = 'store.html'; return; }

        try {
            const { data, error } = await supabaseClient
                .from('products')
                .select('*')
                .ilike('name', decodeURIComponent(productName)) // Decode name from URL
                .single(); // Expect only one product

            if (error) throw error;
            if (!data) throw new Error('Product not found in database.');

            displayProduct(data);
        } catch (error) {
            console.error('Error fetching product:', error);
            container.innerHTML = `<p class="text-center text-red-500 font-bold">Error: Product "${productName}" not found.</p>`;
        }
    }
    function displayProduct(product) {
        const container = document.getElementById('product-page-container');
        if (!Array.isArray(product.packages) || product.packages.length === 0) {
             container.innerHTML = '<p>Error: Product package data is missing.</p>'; return;
        }
        let packagesHTML = product.packages.map(pkg => `<option value="${pkg.price}" data-name="${pkg.text}">${pkg.text}</option>`).join('');
        container.innerHTML = `
            <div class="lg:grid lg:grid-cols-2 lg:gap-8">
                <div><img src="${product.image_url || 'placeholder.png'}" alt="${product.name}" class="w-full h-auto rounded-lg object-contain border"></div>
                <div>
                    <h1 class="text-3xl font-bold text-gray-900 mb-2">${product.name} Data Bundle</h1>
                    <div class="mb-6"><span class="text-2xl font-bold text-gray-900" id="productPrice">₵${product.packages[0].price.toFixed(2)}</span></div>
                    <div class="mb-4">
                        <label for="package-select" class="block text-sm font-medium text-gray-700">Select Package</label>
                        <select id="package-select" class="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">${packagesHTML}</select>
                    </div>
                    <div class="mb-4">
                        <label for="quantity" class="block text-sm font-medium text-gray-700">Quantity</label>
                        <input type="number" id="quantity" value="1" min="1" class="mt-1 block w-full py-2 px-3 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500">
                    </div>
                    <button id="add-to-cart" class="w-full bg-red-500 text-white font-bold py-3 px-4 rounded-md hover:bg-red-600 transition duration-150">Add to Cart</button>
                </div>
            </div>`;
        feather.replace();
        setupProductEventListeners(product);
    }
    function setupProductEventListeners(product) {
        const packageSelect = document.getElementById('package-select');
        const priceEl = document.getElementById('productPrice');
        const addToCartBtn = document.getElementById('add-to-cart');
        const quantityInput = document.getElementById('quantity');

        if (!packageSelect || !priceEl || !addToCartBtn || !quantityInput) {
            console.error("Product page elements not found."); return;
        }

        packageSelect.addEventListener('change', (e) => priceEl.textContent = `₵${parseFloat(e.target.value).toFixed(2)}`);
        
        addToCartBtn.addEventListener('click', () => {
            const selectedOption = packageSelect.options[packageSelect.selectedIndex];
            const quantity = parseInt(quantityInput.value);
            if (isNaN(quantity) || quantity < 1) {
                 alert("Please enter a valid quantity."); return;
            }
            const cartItem = { 
                id: `${product.name}-${selectedOption.dataset.name}`, 
                name: `${product.name} - ${selectedOption.dataset.name.split(' - ')[0]}`, 
                price: parseFloat(selectedOption.value), 
                quantity: quantity 
            };
            let cart = JSON.parse(localStorage.getItem('datadeals-cart')) || [];
            cart.push(cartItem);
            localStorage.setItem('datadeals-cart', JSON.stringify(cart));
            updateCartDisplay();
            alert(`${quantity} x ${cartItem.name} added to cart!`);
        });
    }

    // --- CART PAGE FUNCTIONS ---
    function setupCartPage() {
        const cartItemsContainer = document.getElementById('cart-items');
        const cartTotalEl = document.getElementById('cart-total');
        const clearCartBtn = document.getElementById('clear-cart');
        const checkoutForm = document.getElementById('checkout-form');
        const checkoutSection = document.getElementById('checkout-section');
        const confirmationModal = document.getElementById('confirmation-modal');
        const modalCartItems = document.getElementById('modal-cart-items');
        const modalName = document.getElementById('modal-name');
        const modalPhone = document.getElementById('modal-phone');
        const modalTotal = document.getElementById('modal-total');
        const cancelOrderBtn = document.getElementById('cancel-order-btn');
        const confirmOrderBtn = document.getElementById('confirm-order-btn');

        if (!cartItemsContainer || !cartTotalEl || !clearCartBtn || !checkoutForm || !checkoutSection || !confirmationModal) {
             console.error("Cart page elements missing."); return;
        }

        let cart = JSON.parse(localStorage.getItem('datadeals-cart')) || [];
        let currentOrderDetails = {};

        function renderCart() {
            cartItemsContainer.innerHTML = '';
            let grandTotal = 0;
            if (cart.length === 0) {
                cartItemsContainer.innerHTML = '<p class="text-gray-500 text-center">Your cart is empty.</p>';
                checkoutSection.style.display = 'none';
                cartTotalEl.textContent = '₵0.00';
            } else {
                checkoutSection.style.display = 'block';
                cart.forEach((item, index) => {
                    const itemTotal = item.price * item.quantity;
                    grandTotal += itemTotal;
                    cartItemsContainer.innerHTML += `<div class="flex items-center justify-between py-4 border-b"><div><p class="font-semibold">${item.name}</p><p class="text-sm text-gray-500">₵${item.price.toFixed(2)} x ${item.quantity}</p></div><div class="flex items-center"><p class="font-semibold mr-4">₵${itemTotal.toFixed(2)}</p><button class="text-red-500 hover:text-red-700 remove-item p-1" data-index="${index}" title="Remove item"><i data-feather="trash-2" class="h-5 w-5 pointer-events-none"></i></button></div></div>`;
                });
                cartTotalEl.textContent = `₵${grandTotal.toFixed(2)}`;
                feather.replace();
            }
            updateCartHeaderDisplay();
        }

        clearCartBtn.addEventListener('click', () => {
            if (cart.length > 0 && confirm('Are you sure you want to clear your cart?')) {
                cart = [];
                localStorage.removeItem('datadeals-cart');
                renderCart();
            }
        });

        cartItemsContainer.addEventListener('click', function(e) {
            const removeButton = e.target.closest('.remove-item');
            if(removeButton) {
                const indexToRemove = parseInt(removeButton.dataset.index);
                if (!isNaN(indexToRemove) && indexToRemove >= 0 && indexToRemove < cart.length) {
                    cart.splice(indexToRemove, 1);
                    localStorage.setItem('datadeals-cart', JSON.stringify(cart));
                    renderCart();
                }
            }
        });

        checkoutForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const phone = document.getElementById('phone').value.trim();
            if (!name || !phone) { alert('Please enter your name and phone number.'); return; }
            if (phone.length !== 10 || !phone.startsWith('0')) { alert('Please enter a valid 10-digit Ghanaian number starting with 0.'); return; }
            if (cart.length === 0) { alert('Your cart is empty.'); return;}

            modalCartItems.innerHTML = cart.map(item => `<p>${item.quantity} x ${item.name} (₵${(item.price * item.quantity).toFixed(2)})</p>`).join('');
            modalName.textContent = name;
            modalPhone.textContent = phone;
            modalTotal.textContent = cartTotalEl.textContent;
            currentOrderDetails = { name: name, phone: phone, cart: cart, total: cartTotalEl.textContent };
            confirmationModal.classList.remove('hidden');
        });

        cancelOrderBtn.addEventListener('click', () => {
            confirmationModal.classList.add('hidden');
            currentOrderDetails = {};
        });

        confirmOrderBtn.addEventListener('click', async () => {
            confirmOrderBtn.disabled = true; // Prevent double clicks
            confirmOrderBtn.textContent = 'Processing...';

            const orderNumber = `DD-${Date.now().toString().slice(-7)}`;
            const orderToSave = { order_number: orderNumber, customer_name: currentOrderDetails.name, customer_phone: currentOrderDetails.phone, order_items: currentOrderDetails.cart, order_total: currentOrderDetails.total };
            try {
                const { error } = await supabaseClient.from('orders').insert([orderToSave]);
                if (error) throw error;
                const confirmationDetails = { orderNumber: orderNumber, total: currentOrderDetails.total };
                localStorage.setItem('datadeals-order', JSON.stringify(confirmationDetails));
                localStorage.removeItem('datadeals-cart');
                window.location.href = 'confirmation.html';
            } catch (error) {
                alert('Could not save order. Please try again or contact support.');
                console.error("Error saving order:", error);
                confirmationModal.classList.add('hidden'); // Hide modal on error
                confirmOrderBtn.disabled = false; // Re-enable button
                confirmOrderBtn.textContent = 'Confirm Order & Pay';
            }
        });

        renderCart(); // Initial rendering of the cart
    }
    
    // --- LOGIN PAGE FUNCTIONS ---
    function setupAuthPage() {
        const form = document.getElementById('auth-form');
        const formTitle = document.getElementById('form-title');
        const submitBtn = document.getElementById('submit-btn');
        const toggleBtn = document.getElementById('toggle-btn');
        const feedbackDiv = document.getElementById('feedback');
        const passwordInput = document.getElementById('password');
        const togglePassword = document.getElementById('toggle-password');
        const eyeIcon = document.getElementById('eye-icon');
        let isLoginMode = true;

        if (!form || !toggleBtn || !togglePassword) {
             console.error("Login page elements missing."); return;
        }

        toggleBtn.addEventListener('click', () => {
            isLoginMode = !isLoginMode;
            formTitle.textContent = isLoginMode ? 'Sign in to your account' : 'Create a new account';
            submitBtn.textContent = isLoginMode ? 'Login' : 'Register';
            toggleBtn.textContent = isLoginMode ? 'Need an account? Register' : 'Already have an account? Login';
            feedbackDiv.textContent = '';
            passwordInput.setAttribute('type', 'password'); // Reset password visibility
            eyeIcon.setAttribute('data-feather', 'eye');
            feather.replace();
        });

        togglePassword.addEventListener('click', function () {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);
            const iconName = type === 'password' ? 'eye' : 'eye-off';
            eyeIcon.setAttribute('data-feather', iconName);
            feather.replace();
        });

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const emailInput = document.getElementById('email');
            const email = emailInput.value.trim();
            const password = passwordInput.value;
            if (!email || !password) {
                feedbackDiv.textContent = 'Please enter both email and password.';
                feedbackDiv.className = 'text-sm text-center text-red-500';
                return;
            }

            feedbackDiv.textContent = 'Processing...';
            feedbackDiv.className = 'text-sm text-center text-gray-500';
            submitBtn.disabled = true;

            try {
                if (isLoginMode) {
                    const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
                    if (error) throw error;
                    if (data.user) window.location.href = 'index.html';
                } else {
                    const { data, error } = await supabaseClient.auth.signUp({ email, password });
                    if (error) throw error;
                    feedbackDiv.textContent = 'Registration successful! Please check your email to confirm.';
                    feedbackDiv.className = 'text-sm text-center text-green-500';
                    isLoginMode = true; // Switch to login mode after successful registration
                    formTitle.textContent = 'Sign in to your account';
                    submitBtn.textContent = 'Login';
                    toggleBtn.textContent = 'Need an account? Register';
                }
            } catch (error) {
                feedbackDiv.textContent = error.message;
                feedbackDiv.className = 'text-sm text-center text-red-500';
            } finally {
                submitBtn.disabled = false; // Re-enable button
            }
        });
    }
    
    // --- ORDERS PAGE FUNCTIONS ---
    function setupOrdersPage() {
        const searchBtn = document.getElementById('search-btn');
        const phoneInput = document.getElementById('phone-search');
        const ordersList = document.getElementById('orders-list');

        if (!searchBtn || !phoneInput || !ordersList) {
            console.error("Orders page elements missing."); return;
        }

        searchBtn.addEventListener('click', async () => {
            const phone = phoneInput.value.trim();
            if (!phone) { alert('Please enter a phone number.'); return; }
            ordersList.innerHTML = '<p class="text-center text-gray-500">Searching for orders...</p>';
            try {
                const { data: orders, error } = await supabaseClient
                    .from('orders')
                    .select('*')
                    .eq('customer_phone', phone)
                    .order('created_at', { ascending: false });

                if (error) throw error;

                if (orders.length === 0) {
                    ordersList.innerHTML = '<p class="text-center text-gray-500">No orders found for this phone number.</p>';
                } else {
                    ordersList.innerHTML = ''; // Clear the list
                    orders.forEach(order => {
                        const status = order.status || 'On Hold'; // Default to 'On Hold' if status is null
                        const statusColor = status === 'Completed' ? 'bg-green-100 text-green-800' : (status === 'Processing' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800');
                        ordersList.innerHTML += `
                            <div class="bg-white p-4 rounded-lg shadow-sm">
                                <div class="flex justify-between items-start">
                                    <div>
                                        <p class="font-bold text-lg text-purple-700">${order.order_number}</p>
                                        <p class="text-sm text-gray-500">Date: ${new Date(order.created_at).toLocaleString()}</p>
                                        <p class="text-sm text-gray-700 mt-2">Total: <strong>${order.order_total}</strong></p>
                                    </div>
                                    <span class="text-xs font-medium px-2.5 py-0.5 rounded-full ${statusColor}">${status}</span>
                                </div>
                            </div>`;
                    });
                }
            } catch (error) {
                console.error("Error fetching orders:", error);
                ordersList.innerHTML = '<p class="text-center text-red-500">Could not retrieve orders. Please try again.</p>';
            }
        });
    }
    
    // --- CONFIRMATION PAGE FUNCTIONS ---
    function setupConfirmationPage() {
        const orderTotalEl = document.getElementById('order-total');
        const orderNumberEl = document.getElementById('order-number');

        if (!orderTotalEl || !orderNumberEl) {
             console.error("Confirmation page elements missing.");
             // Optionally redirect if critical elements are gone
             // window.location.href = 'index.html';
             return;
        }

        const orderDetails = JSON.parse(localStorage.getItem('datadeals-order'));
        if (orderDetails) {
            orderTotalEl.textContent = orderDetails.total;
            orderNumberEl.textContent = orderDetails.orderNumber;
        } else {
            // Redirect if order details are missing from storage
            window.location.href = 'index.html';
        }
    }

    // --- PREMIUM DATA PAGE FUNCTIONS ---
    async function loadPremiumProducts() {
        const container = document.getElementById('premium-accordion-container');
        if (!container) return;
        container.innerHTML = '<p class="text-center text-gray-500">Loading premium products...</p>';

        // **SECURITY CHECK:** First, check if user is logged in and premium
        const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
        if (sessionError || !session?.user) {
            container.innerHTML = '<p class="text-center text-red-500">You must be logged in to view premium data.</p><p class="text-center mt-4"><a href="login.html" class="text-blue-600 hover:underline">Login here</a></p>';
            return;
        }

        // Get user's profile to check premium status
        const { data: profile, error: profileError } = await supabaseClient
            .from('profiles')
            .select('is_premium_user')
            .eq('id', session.user.id)
            .single();

        if (profileError || !profile) {
             console.error("Error fetching profile:", profileError);
             container.innerHTML = '<p class="text-center text-red-500">Could not verify your premium status.</p>';
             return;
        }

        if (!profile.is_premium_user) {
            container.innerHTML = '<p class="text-center text-orange-500">Your account needs premium approval to view these products.</p>';
            return;
        }

        // **IF USER IS PREMIUM, LOAD PREMIUM PRODUCTS:**
        // For now, load normal products as a placeholder
        try {
            const { data: products, error } = await supabaseClient.from('products').select('*').order('name'); // Replace with premium logic later
            if (error) throw error;
             if (!products || products.length === 0) {
                 container.innerHTML = '<p class="text-center text-gray-500">No premium products available yet.</p>';
                 return;
             }
            container.innerHTML = '';
            products.forEach(product => container.innerHTML += createPremiumProductHTML(product)); // Use premium HTML creator
            feather.replace();
            setupPremiumAccordion();
        } catch (error) {
            console.error('Error fetching premium products:', error);
            container.innerHTML = '<p class="text-center text-red-500">Could not load premium products.</p>';
        }
    }
    function createPremiumProductHTML(product) {
        // Customize this if premium products look different
        const priceRange = `₵${product.packages[0].price.toFixed(2)} – ₵${product.packages[product.packages.length - 1].price.toFixed(2)}`;
        return `<div><div class="accordion-header p-4 text-white cursor-pointer flex justify-between items-center rounded-lg"><h2 class="text-xl font-bold">${product.name} (Premium)</h2><i data-feather="chevron-down" class="h-5 w-5"></i></div><div class="accordion-content bg-white p-6 rounded-b-lg shadow-sm mb-6 hidden"><div class="flex items-center"><img class="h-16 w-16 object-contain rounded-md" src="${product.image_url}" alt="${product.name}"><div class="ml-4"><p class="text-lg font-semibold">${product.name} Data</p><p class="text-gray-600 mt-1">${priceRange}</p></div></div><div class="mt-4"><a href="product.html?product=${product.name.toLowerCase()}" class="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-md text-sm font-medium transition inline-block text-center">Select options</a></div></div></div>`;
    }
    function setupPremiumAccordion() {
        // This can be the same as setupAccordion for now
        document.querySelectorAll('#premium-accordion-container .accordion-header').forEach(header => {
            header.addEventListener('click', () => { /* ... same accordion logic ... */ });
        });
    }

    // --- AGENT PAGE FUNCTION ---
    function setupAgentPage() {
        const addToCartBtn = document.getElementById('add-agent-to-cart');
        if (!addToCartBtn) return;
        addToCartBtn.addEventListener('click', () => {
            const agentPackage = { id: 'agent-package', name: 'Agent Registration Package', price: 50.00, quantity: 1 };
            let cart = JSON.parse(localStorage.getItem('datadeals-cart')) || [];
            if (cart.some(item => item.id === agentPackage.id)) { alert('Agent package is already in your cart.'); return; }
            cart.push(agentPackage);
            localStorage.setItem('datadeals-cart', JSON.stringify(cart));
            updateCartDisplay();
            alert('Agent Package added to cart!');
            window.location.href = 'cart.html';
        });
    }
}); // End of DOMContentLoaded