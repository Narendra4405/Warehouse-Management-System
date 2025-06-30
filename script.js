// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeNavigation();
    initializeUserManagement();
    initializeMasterSheet();
    initializeDashboard();
    showDefaultPage();
});

// File input handling
document.getElementById('jsonFileInput').addEventListener('change', function(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Update file name display
    document.getElementById('fileName').textContent = file.name;

    const reader = new FileReader();
    reader.onload = function(e) {
        let data;
        try {
            data = JSON.parse(e.target.result);
            updateKPICards(data);
            renderDashboard(Array.isArray(data) ? data : [data]);
        } catch (error) {
            console.error('Error parsing JSON:', error);
            alert('Error parsing JSON file. Please check the file format.');
        }
    };
    reader.readAsText(file);
});

function updateKPICards(data) {
    try {
        // Update Total Inventory
        const totalInventory = document.getElementById('totalInventory');
        totalInventory.textContent = data.items_in_stock || '0';
        
        // Update Storage Utilization
        const storageUtilization = document.getElementById('storageUtilization');
        if (data.storage_utilization && data.storage_utilization.percent_used) {
            storageUtilization.textContent = `${data.storage_utilization.percent_used.toFixed(1)}%`;
            // Add color coding based on utilization
            if (data.storage_utilization.percent_used > 90) {
                storageUtilization.style.color = '#dc3545'; // Red for high utilization
            } else if (data.storage_utilization.percent_used > 70) {
                storageUtilization.style.color = '#ffc107'; // Yellow for moderate utilization
            } else {
                storageUtilization.style.color = '#28a745'; // Green for good utilization
            }
        } else {
            storageUtilization.textContent = '0%';
        }
        
        // Update Pending Orders
        const pendingOrders = document.getElementById('pendingOrders');
        pendingOrders.textContent = data.pending_orders_count || '0';
        // Add tooltip with pending order details if available
        if (data.to_be_processed_orders && data.to_be_processed_orders.length > 0) {
            const orderDetails = data.to_be_processed_orders
                .map(order => `${order.item}: ${order.quantity}`)
                .join('\n');
            pendingOrders.title = `Pending Orders:\n${orderDetails}`;
        }
        
        // Update Low Stock Items
        const lowStockItems = document.getElementById('lowStockItems');
        if (data.low_stock_items && data.low_stock_items.length > 0) {
            lowStockItems.textContent = data.low_stock_items.length;
            // Add tooltip with low stock items details
            const lowStockDetails = data.low_stock_items
                .map(item => `${item.item}: ${item.quantity}`)
                .join('\n');
            lowStockItems.title = `Low Stock Items:\n${lowStockDetails}`;
            lowStockItems.style.color = '#dc3545'; // Red for warning
        } else {
            lowStockItems.textContent = '0';
            lowStockItems.style.color = '#28a745'; // Green for good
        }

        // Add visual indicators for the KPI cards
        updateKPIVisualIndicators(data);
    } catch (error) {
        console.error('Error updating KPI cards:', error);
        // Set default values if there's an error
        document.getElementById('totalInventory').textContent = '-';
        document.getElementById('storageUtilization').textContent = '-';
        document.getElementById('pendingOrders').textContent = '-';
        document.getElementById('lowStockItems').textContent = '-';
    }
}

function updateKPIVisualIndicators(data) {
    // Add visual indicators to KPI cards
    const kpiCards = document.querySelectorAll('.kpi-card');
    
    kpiCards.forEach(card => {
        // Remove any existing indicators
        const existingIndicator = card.querySelector('.kpi-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create new indicator
        const indicator = document.createElement('div');
        indicator.className = 'kpi-indicator';
        
        // Add specific indicators based on the card
        if (card.querySelector('h3').textContent.includes('Storage Utilization')) {
            const utilization = data.storage_utilization?.percent_used || 0;
            indicator.className += utilization > 90 ? ' critical' : utilization > 70 ? ' warning' : ' good';
        } else if (card.querySelector('h3').textContent.includes('Low Stock Items')) {
            const hasLowStock = data.low_stock_items?.length > 0;
            indicator.className += hasLowStock ? ' warning' : ' good';
        } else if (card.querySelector('h3').textContent.includes('Pending Orders')) {
            const hasPendingOrders = data.pending_orders_count > 0;
            indicator.className += hasPendingOrders ? ' warning' : ' good';
        }
        
        card.appendChild(indicator);
    });
}

function renderDashboard(data) {
    const groupBy = (arr, key) => arr.reduce((acc, item) => {
        const val = item[key];
        acc[val] = acc[val] || [];
        acc[val].push(item);
        return acc;
    }, {});

    try {
        // 1. Sales by Product Line
        if (data[0].PRODUCTLINE) {
            const productGroups = groupBy(data, "PRODUCTLINE");
            const productLines = Object.keys(productGroups);
            const salesByProductLine = productLines.map(pl =>
                productGroups[pl].reduce((sum, item) => sum + item.SALES, 0)
            );
            Plotly.newPlot("productLineChart", [{
                x: productLines,
                y: salesByProductLine,
                type: 'bar',
                marker: { color: '#2196F3' }
            }], {
                margin: { t: 10, b: 40, l: 60, r: 10 },
                xaxis: { title: 'Product Line' },
                yaxis: { title: 'Sales ($)' }
            });
        }

        // 2. Monthly Sales Trend
        if (data[0].YEAR_ID && data[0].MONTH_ID) {
            const monthlySales = {};
            data.forEach(item => {
                const label = `${item.YEAR_ID}-${String(item.MONTH_ID).padStart(2, '0')}`;
                monthlySales[label] = (monthlySales[label] || 0) + item.SALES;
            });
            const timeLabels = Object.keys(monthlySales).sort();
            const timeSales = timeLabels.map(label => monthlySales[label]);
            Plotly.newPlot("monthlyTrendChart", [{
                x: timeLabels,
                y: timeSales,
                type: 'scatter',
                mode: 'lines+markers',
                line: { color: '#4CAF50' }
            }], {
                margin: { t: 10, b: 40, l: 60, r: 10 },
                xaxis: { title: 'Month' },
                yaxis: { title: 'Sales ($)' }
            });
        }

        // 3. Sales by Country
        if (data[0].COUNTRY) {
            const countryGroups = groupBy(data, "COUNTRY");
            const countries = Object.keys(countryGroups);
            const salesByCountry = countries.map(c =>
                countryGroups[c].reduce((sum, item) => sum + item.SALES, 0)
            );
            Plotly.newPlot("geoChart", [{
                x: countries,
                y: salesByCountry,
                type: 'bar',
                marker: { color: '#FF9800' }
            }], {
                margin: { t: 10, b: 40, l: 60, r: 10 },
                xaxis: { title: 'Country' },
                yaxis: { title: 'Sales ($)' }
            });
        }

        // 4. Deal Size Distribution
        if (data[0].DEALSIZE) {
            const dealSizeGroups = groupBy(data, "DEALSIZE");
            const dealSizes = Object.keys(dealSizeGroups);
            const dealCounts = dealSizes.map(ds => dealSizeGroups[ds].length);
            Plotly.newPlot("dealSizeChart", [{
                labels: dealSizes,
                values: dealCounts,
                type: 'pie',
                marker: {
                    colors: ['#2196F3', '#4CAF50', '#FF9800', '#F44336']
                }
            }], {
                margin: { t: 10, b: 10, l: 10, r: 10 }
            });
        }

        // 5. Top Customers
        if (data[0].CUSTOMERNAME) {
            const customerGroups = groupBy(data, "CUSTOMERNAME");
            const customerSales = Object.keys(customerGroups).map(c => ({
                name: c,
                total: customerGroups[c].reduce((sum, item) => sum + item.SALES, 0)
            }));
            const topCustomers = customerSales
                .sort((a, b) => b.total - a.total)
                .slice(0, 10);
            Plotly.newPlot("topCustomersChart", [{
                x: topCustomers.map(c => c.total),
                y: topCustomers.map(c => c.name),
                type: 'bar',
                orientation: 'h',
                marker: { color: '#9C27B0' }
            }], {
                margin: { t: 10, b: 40, l: 200, r: 10 },
                xaxis: { title: 'Sales ($)' },
                yaxis: { automargin: true }
            });
        }
    } catch (error) {
        console.error('Error rendering charts:', error);
    }
}

// Navigation and Sidebar Toggle
document.addEventListener('DOMContentLoaded', function() {
    const sidebar = document.querySelector('.sidebar');
    const mainContent = document.querySelector('.main-content');
    const floatingMenu = document.querySelector('.floating-menu');

    // Function to toggle sidebar
    function toggleSidebar() {
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
        floatingMenu.classList.toggle('visible');
    }

    // Event listener for floating menu button
    floatingMenu.addEventListener('click', toggleSidebar);

    // Event listener for sidebar toggle button
    const sidebarToggle = document.getElementById('toggleSidebar');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Handle navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links
            navLinks.forEach(l => l.classList.remove('active'));
            
            // Add active class to clicked link
            this.classList.add('active');
            
            // Get the target page id from href
            const targetId = this.getAttribute('href').substring(1);
            
            // Hide all pages
            document.querySelectorAll('.page').forEach(page => {
                page.classList.remove('active');
            });
            
            // Show target page
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.classList.add('active');
            }
        });
    });
});

// Navigation Functionality
function initializeNavigation() {
    // Navigation handling
    const navLinks = document.querySelectorAll('.nav-links a');
    const pages = document.querySelectorAll('.page');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Remove active class from all links and pages
            navLinks.forEach(l => l.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked link and corresponding page
            this.classList.add('active');
            const targetId = this.getAttribute('href').substring(1);
            const targetPage = document.getElementById(targetId);
            if (targetPage) {
                targetPage.classList.add('active');
                
                // Initialize specific page functionality
                if (targetId === 'report') {
                    setTimeout(initializeReportsCharts, 100);
                }
            }
        });
    });
}

// Reports Charts Initialization
function initializeReportsCharts() {
    if (!window.Plotly) {
        console.warn('Plotly.js is not loaded');
        return;
    }

    // Revenue Trend Chart
    if (document.getElementById('revenueTrendChart')) {
        const revenueTrendData = {
            x: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            y: [65000, 72000, 68000, 85000, 78000, 90000],
            type: 'scatter',
            mode: 'lines+markers',
            line: { color: '#3498db', width: 3 },
            marker: { color: '#3498db', size: 8 }
        };

        const revenueTrendLayout = {
            margin: { t: 20, r: 20, l: 50, b: 40 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { showgrid: true, gridcolor: '#f1f1f1' },
            yaxis: { showgrid: true, gridcolor: '#f1f1f1', tickprefix: '$' }
        };

        Plotly.newPlot('revenueTrendChart', [revenueTrendData], revenueTrendLayout);
    }

    // Category Distribution Chart
    if (document.getElementById('categoryDistChart')) {
        const categoryData = {
            values: [35, 25, 20, 15, 5],
            labels: ['Electronics', 'Clothing', 'Food', 'Books', 'Others'],
            type: 'pie',
            hole: 0.4,
            marker: {
                colors: ['#3498db', '#2ecc71', '#e74c3c', '#f1c40f', '#95a5a6']
            }
        };

        const categoryLayout = {
            margin: { t: 20, r: 20, l: 20, b: 20 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            showlegend: true,
            legend: { orientation: 'h', y: -0.2 }
        };

        Plotly.newPlot('categoryDistChart', [categoryData], categoryLayout);
    }

    // Inventory Health Chart
    if (document.getElementById('inventoryHealthChart')) {
        const inventoryHealthData = {
            x: ['Optimal', 'Low Stock', 'Overstock', 'Out of Stock'],
            y: [60, 20, 15, 5],
            type: 'bar',
            marker: {
                color: ['#2ecc71', '#f1c40f', '#e67e22', '#e74c3c']
            }
        };

        const inventoryHealthLayout = {
            margin: { t: 20, r: 20, l: 50, b: 40 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            xaxis: { showgrid: false },
            yaxis: { showgrid: true, gridcolor: '#f1f1f1', ticksuffix: '%' }
        };

        Plotly.newPlot('inventoryHealthChart', [inventoryHealthData], inventoryHealthLayout);
    }

    // Order Status Chart
    if (document.getElementById('orderStatusChart')) {
        const orderStatusData = {
            values: [45, 30, 15, 10],
            labels: ['Delivered', 'In Transit', 'Processing', 'Delayed'],
            type: 'pie',
            marker: {
                colors: ['#2ecc71', '#3498db', '#f1c40f', '#e74c3c']
            }
        };

        const orderStatusLayout = {
            margin: { t: 20, r: 20, l: 20, b: 20 },
            paper_bgcolor: 'rgba(0,0,0,0)',
            showlegend: true,
            legend: { orientation: 'h', y: -0.2 }
        };

        Plotly.newPlot('orderStatusChart', [orderStatusData], orderStatusLayout);
    }
}

// User Management Functionality
function initializeUserManagement() {
    const userModal = document.getElementById('userModal');
    const addUserBtn = document.getElementById('addUserBtn');

    if (addUserBtn) {
        addUserBtn.addEventListener('click', () => {
            if (userModal) {
                userModal.style.display = 'flex';
                const titleEl = document.getElementById('userModalTitle');
                if (titleEl) titleEl.textContent = 'Add New User';
                const formEl = document.getElementById('userForm');
                if (formEl) formEl.reset();
            }
        });
    }

    if (userModal) {
        const closeBtn = userModal.querySelector('.close-btn');
        const cancelBtn = userModal.querySelector('.cancel-btn');

        function closeModal() {
            userModal.style.display = 'none';
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        window.addEventListener('click', (event) => {
            if (event.target === userModal) closeModal();
        });
    }

    // User search functionality
    const searchInput = document.getElementById('userSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('.data-table tbody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Filters functionality
    const roleFilter = document.getElementById('roleFilter');
    const statusFilter = document.getElementById('statusFilter');

    function applyFilters() {
        const role = roleFilter ? roleFilter.value.toLowerCase() : '';
        const status = statusFilter ? statusFilter.value.toLowerCase() : '';
        
        const rows = document.querySelectorAll('.data-table tbody tr');
        rows.forEach(row => {
            const roleText = row.querySelector('.role-badge')?.textContent.toLowerCase() || '';
            const statusText = row.querySelector('.status-badge')?.textContent.toLowerCase() || '';
            
            const roleMatch = !role || roleText.includes(role);
            const statusMatch = !status || statusText.includes(status);
            
            row.style.display = (roleMatch && statusMatch) ? '' : 'none';
        });
    }

    if (roleFilter) roleFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);

    // Form submission
    const userForm = document.getElementById('userForm');
    if (userForm) {
        userForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (userModal) userModal.style.display = 'none';
            alert('User saved successfully!');
        });
    }
}

// Master Sheet Functionality
function initializeMasterSheet() {
    const itemModal = document.getElementById('itemModal');
    const addItemBtn = document.getElementById('addItemBtn');

    if (addItemBtn && itemModal) {
        addItemBtn.addEventListener('click', () => {
            itemModal.style.display = 'flex';
        });

        const closeBtn = itemModal.querySelector('.close-btn');
        const cancelBtn = itemModal.querySelector('.cancel-btn');

        function closeModal() {
            itemModal.style.display = 'none';
        }

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        window.addEventListener('click', (event) => {
            if (event.target === itemModal) closeModal();
        });
    }

    // Search functionality
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const rows = document.querySelectorAll('#inventoryTableBody tr');
            
            rows.forEach(row => {
                const text = row.textContent.toLowerCase();
                row.style.display = text.includes(searchTerm) ? '' : 'none';
            });
        });
    }

    // Filters functionality
    const categoryFilter = document.getElementById('categoryFilter');
    const statusFilter = document.getElementById('statusFilter');
    const sortBy = document.getElementById('sortBy');

    function applyFilters() {
        const category = categoryFilter ? categoryFilter.value.toLowerCase() : '';
        const status = statusFilter ? statusFilter.value.toLowerCase() : '';
        
        const rows = document.querySelectorAll('#inventoryTableBody tr');
        rows.forEach(row => {
            const categoryText = row.children[2]?.textContent.toLowerCase() || '';
            const statusText = row.children[5]?.textContent.toLowerCase() || '';
            
            const categoryMatch = !category || categoryText.includes(category);
            const statusMatch = !status || statusText.includes(status);
            
            row.style.display = (categoryMatch && statusMatch) ? '' : 'none';
        });
    }

    if (categoryFilter) categoryFilter.addEventListener('change', applyFilters);
    if (statusFilter) statusFilter.addEventListener('change', applyFilters);
    if (sortBy) sortBy.addEventListener('change', applyFilters);
}

// Show default page
function showDefaultPage() {
    const defaultPage = document.querySelector('.nav-links a[href="#dashboard"]');
    if (defaultPage) {
        defaultPage.click();
    }
} 