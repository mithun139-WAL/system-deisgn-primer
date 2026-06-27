// Fallback Flashcards Database (in case flashcards.json fails to load)
const FALLBACK_FLASHCARDS = [
    {
        question: "What is the difference between Latency and Throughput?",
        answer: "Latency is the time to perform some action or to produce some result. Throughput is the number of such actions or results per unit of time. Generally, you should aim for maximal throughput with acceptable latency."
    },
    {
        question: "What is the CAP Theorem?",
        answer: "In a distributed computer system, you can only support two of the following guarantees: Consistency (every read receives the most recent write or an error), Availability (every request receives a response), and Partition Tolerance (system continues to operate despite network failures). Since networks are unreliable, you must choose between Consistency (CP) and Availability (AP)."
    },
    {
        question: "What is DNS (Domain Name System)?",
        answer: "DNS translates a domain name (like www.example.com) to an IP address. It is hierarchical and heavily cached. Managed DNS routing policies include Weighted Round Robin, Latency-based, and Geolocation-based routing."
    },
    {
        question: "What is a Content Delivery Network (CDN)?",
        answer: "A CDN is a globally distributed network of proxy servers that serves content (usually static assets like HTML/CSS/JS, images, videos) from locations closer to the user. CDNs can be Push (upload directly) or Pull (cache on first request)."
    },
    {
        question: "What are the key benefits of a Load Balancer?",
        answer: "Load balancers distribute incoming requests to computing resources. They: 1) Prevent requests from going to unhealthy servers, 2) Prevent overloading resources, and 3) Eliminate single points of failure. They also handle SSL termination and session persistence."
    },
    {
        question: "Load Balancer vs. Reverse Proxy - What is the difference?",
        answer: "A load balancer distributes traffic across multiple servers serving the same function. A reverse proxy centralizes internal services and provides unified interfaces to the public, even with just one web server. It adds benefits like security, caching, compression, and SSL termination."
    },
    {
        question: "What is Database Sharding?",
        answer: "Sharding distributes database rows across different database servers. It allows write traffic to scale horizontally by partition, but adds complexity: 1) App logic must route queries, 2) Joins across shards are extremely difficult, and 3) Re-sharding is complex."
    },
    {
        question: "What is the Cache-Aside pattern?",
        answer: "The application looks for entry in cache; if it is a hit, returns data. If a miss, the application reads from database, returns data, and stores it in the cache for future reads. Writes go directly to the database, and the cache entry is invalidated."
    },
    {
        question: "What are Message Queues and Task Queues?",
        answer: "Message queues (like RabbitMQ) and Task queues (like Celery) receive, hold, and deliver messages or asynchronous tasks. They decouple the client request from heavy background processing, enabling asynchronism and helping handle back pressure."
    },
    {
        question: "What is the difference between Weak, Eventual, and Strong Consistency?",
        answer: "Weak Consistency: After a write, reads may or may not see it (e.g. VoIP). Eventual Consistency: After a write, reads will eventually see it, typically within milliseconds (e.g. DNS, email). Strong Consistency: After a write, reads will immediately see it, replicated synchronously (e.g. RDBMS transactions)."
    },
    {
        question: "What is Master-Slave Database Replication?",
        answer: "The master database handles writes and replicates them to one or more slave databases, which handle read traffic. Slaves can take over if the master fails, but replication lag can result in stale reads from slaves."
    },
    {
        question: "What are Microservices?",
        answer: "A suite of independently deployable, small, modular services where each service runs a unique process and communicates through a lightweight mechanism (like REST/gRPC) to serve a specific business goal."
    }
];

// App State
let topicsData = [];
let flashcardsData = { decks: [] };
let activeCards = [];
let currentPath = '';
let currentAnchor = '';
let currentLanguage = 'en';
let activeFlashcardIndex = 0;
let flashcardScores = { correct: 0, incorrect: 0, history: {} };

// DOM Elements
const sidebarNav = document.getElementById('sidebar-nav');
const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search');
const languageSelect = document.getElementById('language-select');
const breadcrumbs = document.getElementById('breadcrumbs');
const tabsContainer = document.getElementById('tabs-container');
const markdownContainer = document.getElementById('markdown-container');
const notebookContainer = document.getElementById('notebook-container');
const outlineNav = document.getElementById('outline-nav');
const documentView = document.getElementById('document-view');
const flashcardsView = document.getElementById('flashcards-view');
const flashcardsToggleBtn = document.getElementById('flashcards-toggle-btn');
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileFlashcardsBtn = document.getElementById('mobile-flashcards-btn');
const deckSelect = document.getElementById('deck-select');

// Initialize App
async function init() {
    // Configure Marked custom renderers with backwards compatibility for marked v11+ (which passes a single token object)
    marked.use({
        renderer: {
            heading(arg1, arg2, arg3) {
                let text, depth, raw;
                if (arg1 && typeof arg1 === 'object' && arg1.depth !== undefined) {
                    text = arg1.text;
                    depth = arg1.depth;
                    raw = arg1.raw;
                } else {
                    text = arg1;
                    depth = arg2;
                    raw = arg3;
                }
                const cleanText = raw.replace(/<[^>]*>/g, '');
                const id = cleanText
                    .toLowerCase()
                    .trim()
                    .replace(/[^a-z0-9]+/g, '-')
                    .replace(/(^-|-$)/g, '');
                return `<h${depth} id="${id}">${text}</h${depth}>`;
            },
            image(arg1, arg2, arg3) {
                let href, title, text;
                if (arg1 && typeof arg1 === 'object' && arg1.href !== undefined) {
                    href = arg1.href;
                    title = arg1.title;
                    text = arg1.text;
                } else {
                    href = arg1;
                    title = arg2;
                    text = arg3;
                }
                let resolvedHref = href;
                if (href && !href.startsWith('http') && !href.startsWith('/') && !href.startsWith('data:')) {
                    const folderPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
                    resolvedHref = folderPath ? `../${folderPath}/${href}` : `../${href}`;
                }
                return `<img src="${resolvedHref}" alt="${text || ''}" title="${title || ''}">`;
            },
            link(arg1, arg2, arg3) {
                let href, title, text;
                if (arg1 && typeof arg1 === 'object' && arg1.href !== undefined) {
                    href = arg1.href;
                    title = arg1.title;
                    text = arg1.text;
                } else {
                    href = arg1;
                    title = arg2;
                    text = arg3;
                }
                if (href && href.startsWith('#')) {
                    return `<a href="${href}">${text}</a>`;
                }
                if (href && href.endsWith('.md') && !href.startsWith('http') && !href.startsWith('/') && !href.startsWith('data:')) {
                    const resolvedRef = resolveRelativePath(currentPath, href);
                    return `<a href="#path=${resolvedRef}">${text}</a>`;
                }
                if (href && (href.startsWith('http') || href.startsWith('//'))) {
                    return `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
                }
                return `<a href="${href}">${text}</a>`;
            }
        }
    });

    // Load local storage scores if present
    const savedScores = localStorage.getItem('sdp_flashcard_scores');
    if (savedScores) {
        try {
            flashcardScores = JSON.parse(savedScores);
        } catch (e) {
            console.error("Failed to parse saved scores", e);
        }
    }
    updateScoreUI();

    // 1. Fetch navigation topics index
    try {
        const response = await fetch('topics.json');
        topicsData = await response.json();
        renderSidebar(topicsData);
    } catch (e) {
        sidebarNav.innerHTML = `<div class="nav-error"><i data-lucide="alert-triangle"></i><span>Failed to load index. Make sure you serve this workspace via a web server.</span></div>`;
        lucide.createIcons();
        console.error(e);
        return;
    }

    // 2. Fetch extracted Anki flashcards
    try {
        const response = await fetch('flashcards.json');
        flashcardsData = await response.json();
        setupDeckSelector();
    } catch (e) {
        console.warn("Failed to load flashcards.json, falling back to static ones", e);
        flashcardsData = {
            decks: [
                {
                    name: "System Design (Core)",
                    cards: FALLBACK_FLASHCARDS
                }
            ]
        };
        setupDeckSelector();
    }

    // Attach Routing Hash Listener
    window.addEventListener('hashchange', handleRouting);

    // Attach Global Event Listeners
    searchInput.addEventListener('input', handleSearch);
    clearSearchBtn.addEventListener('click', clearSearch);
    languageSelect.addEventListener('change', handleLanguageChange);
    flashcardsToggleBtn.addEventListener('click', toggleFlashcardsView);
    mobileFlashcardsBtn.addEventListener('click', toggleFlashcardsView);
    deckSelect.addEventListener('change', handleDeckChange);

    mobileMenuToggle.addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
    });

    // Close mobile sidebar when clicking outside it or clicking a nav link inside it
    document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768) {
            const sidebar = document.querySelector('.sidebar');
            const toggle = document.getElementById('mobile-menu-toggle');
            if (sidebar.classList.contains('active')) {
                // If user clicks a link inside the sidebar, or clicks outside the sidebar entirely (and not the toggle button)
                const isNavLink = e.target.closest('a') && sidebar.contains(e.target);
                const isOutside = !sidebar.contains(e.target) && !toggle.contains(e.target);
                if (isNavLink || isOutside) {
                    sidebar.classList.remove('active');
                }
            }
        }
    });

    // Catch link clicks inside the container to handle internal section links
    markdownContainer.addEventListener('click', (e) => {
        const link = e.target.closest('a');
        if (!link) return;

        const href = link.getAttribute('href');
        if (href && href.startsWith('#')) {
            e.preventDefault();
            const anchorId = href.substring(1);

            // Check if this anchor exists in our topics list
            let foundTopic = null;
            for (const group of topicsData) {
                const match = group.items.find(item => item.anchor === anchorId);
                if (match) {
                    foundTopic = match;
                    break;
                }
            }

            if (foundTopic) {
                // Navigate to the other sliced page
                window.location.hash = `#path=${foundTopic.path}&anchor=${foundTopic.anchor}`;
            } else {
                // Scroll internally if element exists on active page
                scrollToAnchor(anchorId);
            }
        }
    });

    // Set initial route
    if (!window.location.hash) {
        window.location.hash = '#path=README-en.md&anchor=motivation';
    } else {
        handleRouting();
    }

    // Init Flashcards
    setupFlashcards();

    // Init Icons
    lucide.createIcons();
}

// ----------------------------------------------------
// ROUTING & FETCHING
// ----------------------------------------------------
function handleRouting() {
    const hash = window.location.hash.substring(1);
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const path = params.get('path');
    const anchor = params.get('anchor') || '';

    // Highlight active sidebar item
    updateActiveSidebarLink(path, anchor);

    // Switch views to Document view (in case user was in flashcards)
    showView('document');

    if (path) {
        const anchorChanged = anchor !== currentAnchor;
        if (path !== currentPath || anchorChanged || currentLanguage !== languageSelect.value) {
            currentPath = path;
            currentAnchor = anchor;
            currentLanguage = languageSelect.value;
            fetchAndDisplayFile(path, anchor);
        } else if (anchor) {
            // Already on this path and same anchor, just make sure we scroll to it (e.g. outline clicked)
            scrollToAnchor(anchor);
        }
    }
}

function findTopicByPath(path) {
    for (const group of topicsData) {
        const match = group.items.find(item => item.path === path);
        if (match) return match;
    }
    return null;
}

async function fetchAndDisplayFile(path, anchor) {
    breadcrumbs.innerHTML = `<span>Loading...</span>`;
    markdownContainer.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
    notebookContainer.innerHTML = '';
    notebookContainer.style.display = 'none';
    markdownContainer.style.display = 'block';

    // Clear tabs container and pagination container
    tabsContainer.style.display = 'none';
    tabsContainer.innerHTML = '';
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
        paginationContainer.innerHTML = '';
        paginationContainer.style.display = 'none';
    }

    // Resolve translation paths
    const resolvedPath = getResolvedTranslationPath(path, currentLanguage);
    const fetchUrl = `../${resolvedPath}`;

    try {
        let response = await fetch(fetchUrl);

        // If translation fetch fails (404), fall back to original English path
        if (!response.ok && resolvedPath !== path) {
            console.warn(`Translation path ${resolvedPath} not found. Falling back to English.`);
            response = await fetch(`../${path}`);
        }

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        // Update breadcrumbs
        updateBreadcrumbs(path);

        // Fetch description text (or notebook json)
        let fileContent;
        if (path.endsWith('.ipynb')) {
            fileContent = await response.json();
        } else {
            fileContent = await response.text();
        }

        // Check if there are code files listed for this topic in topics.json
        const currentTopic = findTopicByPath(path);

        if (currentTopic && currentTopic.code_files && currentTopic.code_files.length > 0) {
            setupCodeTabs(currentTopic, fileContent, anchor);
        } else {
            // Render directly
            if (path.endsWith('.ipynb')) {
                renderJupyterNotebook(fileContent);
            } else {
                renderMarkdown(fileContent, path, anchor);
            }
            generateOutlineNav();
        }

        // Render pagination at the bottom
        renderPagination(path, anchor);

        // Scroll to anchor or top
        if (anchor) {
            setTimeout(() => scrollToAnchor(anchor), 150);
        } else {
            document.querySelector('.content-body').scrollTop = 0;
        }

    } catch (e) {
        breadcrumbs.innerHTML = `<span class="error-text">Error</span>`;
        markdownContainer.innerHTML = `
            <div class="welcome-card error-card">
                <i data-lucide="alert-circle" class="welcome-icon" style="color: var(--accent-red)"></i>
                <h2>Failed to Load File</h2>
                <p>${e.message}</p>
                <p>Ensure your local HTTP server is running inside the project root.</p>
            </div>
        `;
        lucide.createIcons();
        console.error(e);
    }
}

// Set up tabs for Explanation vs Python source files
function setupCodeTabs(topic, explanationContent, anchor) {
    tabsContainer.innerHTML = '';
    tabsContainer.style.display = 'flex';

    // 1. Create Explanation Tab
    const expTab = document.createElement('button');
    expTab.className = 'tab-button active';
    expTab.innerHTML = `<i data-lucide="book-open"></i><span>Explanation</span>`;
    expTab.addEventListener('click', () => {
        setActiveTabButton(expTab);
        markdownContainer.innerHTML = '';
        if (topic.path.endsWith('.ipynb')) {
            renderJupyterNotebook(explanationContent);
        } else {
            renderMarkdown(explanationContent, topic.path, anchor);
        }
        generateOutlineNav();
        Prism.highlightAllUnder(markdownContainer);
        Prism.highlightAllUnder(notebookContainer);
    });
    tabsContainer.appendChild(expTab);

    // 2. Create Code File Tabs
    topic.code_files.forEach(codeFile => {
        const codeTab = document.createElement('button');
        codeTab.className = 'tab-button';
        codeTab.innerHTML = `<i data-lucide="file-code"></i><span>${codeFile.name}</span>`;
        codeTab.addEventListener('click', () => {
            setActiveTabButton(codeTab);
            loadCodeFileTab(codeFile.path);
        });
        tabsContainer.appendChild(codeTab);
    });

    // Render initial explanation tab
    if (topic.path.endsWith('.ipynb')) {
        renderJupyterNotebook(explanationContent);
    } else {
        renderMarkdown(explanationContent, topic.path, anchor);
    }
    generateOutlineNav();
    Prism.highlightAllUnder(markdownContainer);
    Prism.highlightAllUnder(notebookContainer);

    lucide.createIcons();
}

function setActiveTabButton(activeBtn) {
    tabsContainer.querySelectorAll('.tab-button').forEach(btn => {
        btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
}

async function loadCodeFileTab(codeFilePath) {
    markdownContainer.innerHTML = `<div class="spinner-container"><div class="spinner"></div></div>`;
    notebookContainer.style.display = 'none';
    markdownContainer.style.display = 'block';

    try {
        const res = await fetch(`../${codeFilePath}`);
        if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
        const codeText = await res.text();

        // Render raw code inside pre block
        markdownContainer.innerHTML = `
            <div class="code-header-bar">
                <span class="file-name-label">${codeFilePath.split('/').pop()}</span>
                <button class="clay-btn icon-btn copy-code-btn" onclick="copyCodeText(this)"><i data-lucide="copy"></i> Copy Code</button>
            </div>
            <pre class="language-python" style="margin-top:0 !important; border-radius: 0 0 18px 18px !important;"><code class="language-python">${escapeHtml(codeText)}</code></pre>
        `;

        Prism.highlightAllUnder(markdownContainer);
        lucide.createIcons();

        // Clear outline panel
        outlineNav.innerHTML = `<span class="no-outline">No headings in source code</span>`;
    } catch (e) {
        markdownContainer.innerHTML = `
            <div class="welcome-card error-card">
                <h2>Failed to load code file</h2>
                <p>${e.message}</p>
            </div>
        `;
    }
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Dynamic Copy Code logic
window.copyCodeText = function (btn) {
    const codeBlock = btn.closest('.code-header-bar').nextElementSibling.querySelector('code');
    if (codeBlock) {
        navigator.clipboard.writeText(codeBlock.textContent).then(() => {
            btn.innerHTML = `<i data-lucide="check"></i> Copied!`;
            lucide.createIcons();
            setTimeout(() => {
                btn.innerHTML = `<i data-lucide="copy"></i> Copy Code`;
                lucide.createIcons();
            }, 2000);
        });
    }
};

// Translate filename paths if available
function getResolvedTranslationPath(path, lang) {
    if (path === 'README-en.md') {
        return lang === 'en' ? 'README-en.md' : `README-${lang}.md`;
    }

    if (lang === 'en') return path;

    if (path === 'README.md') {
        return `README-${lang}.md`;
    }

    if (path.startsWith('solutions/system_design/') && path.endsWith('README.md') && lang === 'zh-Hans') {
        return path.replace('README.md', 'README-zh-Hans.md');
    }

    return path;
}

// ----------------------------------------------------
// RENDERING ENGINES
// ----------------------------------------------------
function sliceMarkdownHtml(htmlContent, anchor) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;

    let startEl = tempDiv.querySelector(`#${anchor}`) || tempDiv.querySelector(`[id="${anchor}"]`);

    if (!startEl) {
        const cleanAnchor = anchor.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        startEl = tempDiv.querySelector(`#${cleanAnchor}`) || tempDiv.querySelector(`[id="${cleanAnchor}"]`);
    }

    if (!startEl) return htmlContent;

    const startTagName = startEl.tagName;
    const gatheredElements = [];

    gatheredElements.push(startEl.cloneNode(true));

    let currentSibling = startEl.nextElementSibling;
    while (currentSibling) {
        const sibTagName = currentSibling.tagName;

        if (sibTagName && sibTagName.startsWith('H')) {
            const startLevel = parseInt(startTagName.substring(1));
            const sibLevel = parseInt(sibTagName.substring(1));

            if (sibLevel <= startLevel) {
                break;
            }
        }

        gatheredElements.push(currentSibling.cloneNode(true));
        currentSibling = currentSibling.nextElementSibling;
    }

    const resultDiv = document.createElement('div');
    gatheredElements.forEach(el => resultDiv.appendChild(el));
    return resultDiv.innerHTML;
}

function renderPagination(path, anchor) {
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    const flatLinks = [];
    topicsData.forEach(group => {
        group.items.forEach(item => {
            flatLinks.push(item);
        });
    });

    const activeIdx = flatLinks.findIndex(item => {
        return item.path === path && (item.anchor || '') === anchor;
    });

    if (activeIdx === -1) {
        paginationContainer.style.display = 'none';
        return;
    }

    paginationContainer.style.display = 'flex';

    const prevLink = activeIdx > 0 ? flatLinks[activeIdx - 1] : null;
    const nextLink = activeIdx < flatLinks.length - 1 ? flatLinks[activeIdx + 1] : null;

    if (prevLink) {
        const prevBtn = document.createElement('button');
        prevBtn.className = 'clay-btn prev-topic-btn';
        prevBtn.innerHTML = `
            <i data-lucide="chevron-left"></i>
            <div>
                <span class="nav-direction">PREVIOUS</span>
                <span class="nav-title">${prevLink.title}</span>
            </div>
        `;
        prevBtn.addEventListener('click', () => {
            navigateToItem(prevLink.path, prevLink.anchor || '');
        });
        paginationContainer.appendChild(prevBtn);
    } else {
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        paginationContainer.appendChild(spacer);
    }

    if (nextLink) {
        const nextBtn = document.createElement('button');
        nextBtn.className = 'clay-btn next-topic-btn';
        nextBtn.innerHTML = `
            <div>
                <span class="nav-direction">NEXT</span>
                <span class="nav-title">${nextLink.title}</span>
            </div>
            <i data-lucide="chevron-right"></i>
        `;
        nextBtn.addEventListener('click', () => {
            navigateToItem(nextLink.path, nextLink.anchor || '');
        });
        paginationContainer.appendChild(nextBtn);
    } else {
        const spacer = document.createElement('div');
        spacer.style.flex = '1';
        paginationContainer.appendChild(spacer);
    }

    lucide.createIcons();
}

window.navigateToItem = function (path, anchor) {
    let hash = `#path=${path}`;
    if (anchor) hash += `&anchor=${anchor}`;
    window.location.hash = hash;
};

function renderMarkdown(markdownText, filePath, anchor) {
    let htmlContent = marked.parse(markdownText);

    // Slice HTML if anchor is provided (to isolate the active topic)
    if (anchor) {
        htmlContent = sliceMarkdownHtml(htmlContent, anchor);
    }

    markdownContainer.innerHTML = htmlContent;

    // Resolve any raw HTML <img> tag relative paths that bypassed custom marked renderer
    const folderPath = filePath.substring(0, filePath.lastIndexOf('/'));
    const imgs = markdownContainer.querySelectorAll('img');
    imgs.forEach(img => {
        const src = img.getAttribute('src');
        if (src && !src.startsWith('http') && !src.startsWith('/') && !src.startsWith('data:') && !src.startsWith('.') && !src.startsWith('..')) {
            img.src = folderPath ? `../${folderPath}/${src}` : `../${src}`;
        }
    });
}

function renderJupyterNotebook(notebookJson) {
    markdownContainer.style.display = 'none';
    notebookContainer.style.display = 'flex';
    notebookContainer.innerHTML = '';

    const cells = notebookJson.cells || [];

    cells.forEach((cell, idx) => {
        const cellType = cell.cell_type;
        const sourceLines = cell.source || [];
        const sourceText = sourceLines.join('');

        if (cellType === 'markdown') {
            const cellHtml = marked.parse(sourceText);
            const card = document.createElement('div');
            card.className = 'notebook-cell markdown-cell';
            card.innerHTML = `
                <div class="cell-type-badge">Explanation</div>
                <div class="cell-content">${cellHtml}</div>
            `;
            notebookContainer.appendChild(card);
        } else if (cellType === 'code') {
            const card = document.createElement('div');
            card.className = 'notebook-cell code-cell';

            const badge = document.createElement('div');
            badge.className = 'cell-type-badge';
            badge.innerText = 'Python Code';
            card.appendChild(badge);

            const pre = document.createElement('pre');
            pre.className = 'language-python';
            const code = document.createElement('code');
            code.className = 'language-python';
            code.textContent = sourceText;
            pre.appendChild(code);
            card.appendChild(pre);

            notebookContainer.appendChild(card);
        }
    });
}

function resolveRelativePath(currentFilePath, relativePath) {
    const currentParts = currentFilePath.split('/');
    currentParts.pop();

    const relParts = relativePath.split('/');
    for (const part of relParts) {
        if (part === '..') {
            currentParts.pop();
        } else if (part !== '.') {
            currentParts.push(part);
        }
    }
    return currentParts.join('/');
}

// ----------------------------------------------------
// INTERFACE CONTROLS & SIDEBAR
// ----------------------------------------------------
function renderSidebar(data) {
    sidebarNav.innerHTML = '';

    data.forEach(group => {
        const groupContainer = document.createElement('div');
        groupContainer.className = 'nav-group';

        const title = document.createElement('div');
        title.className = 'nav-group-title';
        title.innerText = group.category;
        groupContainer.appendChild(title);

        const list = document.createElement('ul');
        list.className = 'nav-list';

        group.items.forEach(item => {
            const li = document.createElement('li');
            li.className = 'nav-item';

            let iconName = 'book';
            if (item.path.endsWith('.ipynb')) iconName = 'terminal';
            if (item.path.startsWith('solutions/system_design/')) iconName = 'compass';
            if (item.anchor === 'study-guide') iconName = 'calendar';
            if (item.anchor === 'how-to-approach-a-system-design-interview-question') iconName = 'help-circle';

            li.innerHTML = `<i data-lucide="${iconName}"></i><span>${item.title}</span>`;

            li.dataset.path = item.path;
            if (item.anchor) li.dataset.anchor = item.anchor;

            li.addEventListener('click', () => {
                let hash = `#path=${item.path}`;
                if (item.anchor) hash += `&anchor=${item.anchor}`;
                window.location.hash = hash;
                document.querySelector('.sidebar').classList.remove('active');
            });

            list.appendChild(li);
        });

        groupContainer.appendChild(list);
        sidebarNav.appendChild(groupContainer);
    });

    lucide.createIcons();
}

function updateActiveSidebarLink(path, anchor) {
    const items = sidebarNav.querySelectorAll('.nav-item');
    items.forEach(item => {
        const itemPath = item.dataset.path;
        const itemAnchor = item.dataset.anchor || '';

        if (itemPath === path && itemAnchor === anchor) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function updateBreadcrumbs(path) {
    let parts = [];
    if (path === 'README.md' || path === 'README-en.md') {
        parts = ['Theory', 'Introduction'];
    } else if (path.startsWith('solutions/system_design/')) {
        const name = path.split('/')[2].replace('_', ' ');
        parts = ['System Design', name.charAt(0).toUpperCase() + name.slice(1)];
    } else if (path.startsWith('solutions/object_oriented_design/')) {
        const name = path.split('/')[2].replace('_', ' ');
        parts = ['OOD Exercises', name.charAt(0).toUpperCase() + name.slice(1)];
    } else {
        parts = ['Explorer', path];
    }

    breadcrumbs.innerHTML = parts.map((part, i) => {
        if (i === parts.length - 1) {
            return `<span class="current">${part}</span>`;
        }
        return `<span>${part}</span><span class="divider">/</span>`;
    }).join('');
}

// ----------------------------------------------------
// OUTLINE & SCROLL NAVIGATION
// ----------------------------------------------------
function generateOutlineNav() {
    outlineNav.innerHTML = '';

    const isNotebook = notebookContainer.style.display === 'flex';
    const sourceContainer = isNotebook ? notebookContainer : markdownContainer;
    const headings = sourceContainer.querySelectorAll('h2, h3');

    if (headings.length === 0) {
        outlineNav.innerHTML = `<span class="no-outline">No headings on this page</span>`;
        return;
    }

    headings.forEach((heading, index) => {
        if (!heading.id) {
            heading.id = heading.innerText.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        }

        const link = document.createElement('a');
        link.className = `outline-link ${heading.tagName === 'H3' ? 'h3-link' : 'h2-link'}`;
        link.innerText = heading.innerText.replace(/[🔗#]/g, '').trim();
        link.dataset.targetId = heading.id;

        link.addEventListener('click', (e) => {
            e.preventDefault();
            scrollToAnchor(heading.id);
            outlineNav.querySelectorAll('.outline-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
        });

        outlineNav.appendChild(link);
    });
}

function scrollToAnchor(id) {
    const heading = document.getElementById(id);
    if (heading) {
        heading.scrollIntoView({ behavior: 'smooth' });
    }
}

// ----------------------------------------------------
// SEARCH FILTERING
// ----------------------------------------------------
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();

    if (query.length > 0) {
        clearSearchBtn.style.display = 'block';
    } else {
        clearSearchBtn.style.display = 'none';
    }

    const groups = sidebarNav.querySelectorAll('.nav-group');
    groups.forEach(group => {
        const items = group.querySelectorAll('.nav-item');
        let groupHasMatch = false;

        items.forEach(item => {
            const itemText = item.querySelector('span').innerText.toLowerCase();
            const isMatch = itemText.includes(query);

            if (isMatch) {
                item.style.display = 'flex';
                groupHasMatch = true;
            } else {
                item.style.display = 'none';
            }
        });

        if (groupHasMatch) {
            group.style.display = 'block';
        } else {
            group.style.display = 'none';
        }
    });
}

function clearSearch() {
    searchInput.value = '';
    clearSearchBtn.style.display = 'none';

    const groups = sidebarNav.querySelectorAll('.nav-group');
    groups.forEach(group => {
        group.style.display = 'block';
        const items = group.querySelectorAll('.nav-item');
        items.forEach(item => {
            item.style.display = 'flex';
        });
    });
}

function handleLanguageChange() {
    handleRouting();
}

function showView(viewName) {
    if (viewName === 'document') {
        documentView.classList.add('active');
        flashcardsView.style.display = 'none';
        flashcardsToggleBtn.innerHTML = `<i data-lucide="cards"></i><span>Flashcard Quiz</span>`;
        document.getElementById('outline-aside').style.display = 'flex';
        breadcrumbs.style.visibility = 'visible';
    } else if (viewName === 'flashcards') {
        documentView.classList.remove('active');
        flashcardsView.style.display = 'block';
        flashcardsToggleBtn.innerHTML = `<i data-lucide="book-open"></i><span>Back to Reading</span>`;
        document.getElementById('outline-aside').style.display = 'none';
        breadcrumbs.innerHTML = `<span>Flashcards</span>`;
    }
    lucide.createIcons();
}

function toggleFlashcardsView() {
    if (flashcardsView.style.display === 'none') {
        showView('flashcards');
    } else {
        showView('document');
        handleRouting();
    }
}

// ----------------------------------------------------
// INTERACTIVE FLASHCARDS LOGIC
// ----------------------------------------------------
function setupDeckSelector() {
    deckSelect.innerHTML = '';

    // Add "All Decks" option
    let totalCards = 0;
    flashcardsData.decks.forEach(deck => {
        totalCards += deck.cards.length;
    });

    const allOption = document.createElement('option');
    allOption.value = 'all';
    allOption.innerText = `All Decks (${totalCards} Cards)`;
    deckSelect.appendChild(allOption);

    // Add individual deck options
    flashcardsData.decks.forEach((deck, idx) => {
        const opt = document.createElement('option');
        opt.value = idx.toString();
        opt.innerText = `${deck.name} (${deck.cards.length} Cards)`;
        deckSelect.appendChild(opt);
    });

    filterActiveCards();
}

function filterActiveCards() {
    const selectedVal = deckSelect.value;
    activeCards = [];

    if (selectedVal === 'all') {
        flashcardsData.decks.forEach(deck => {
            activeCards = activeCards.concat(deck.cards);
        });
    } else {
        const deckIdx = parseInt(selectedVal);
        activeCards = flashcardsData.decks[deckIdx].cards;
    }

    activeFlashcardIndex = 0;
    displayActiveFlashcard();
}

function handleDeckChange() {
    filterActiveCards();
}

function setupFlashcards() {
    const cardElement = document.getElementById('flashcard');
    const prevBtn = document.getElementById('prev-card-btn');
    const nextBtn = document.getElementById('next-card-btn');
    const markWrongBtn = document.getElementById('mark-wrong-btn');
    const markCorrectBtn = document.getElementById('mark-correct-btn');
    const resetQuizBtn = document.getElementById('reset-quiz-btn');

    cardElement.addEventListener('click', () => {
        cardElement.classList.toggle('flipped');
    });

    prevBtn.addEventListener('click', () => {
        if (activeCards.length === 0) return;
        activeFlashcardIndex = (activeFlashcardIndex - 1 + activeCards.length) % activeCards.length;
        displayActiveFlashcard();
    });

    nextBtn.addEventListener('click', () => {
        if (activeCards.length === 0) return;
        activeFlashcardIndex = (activeFlashcardIndex + 1) % activeCards.length;
        displayActiveFlashcard();
    });

    markWrongBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        registerScore(false);
    });

    markCorrectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        registerScore(true);
    });

    resetQuizBtn.addEventListener('click', () => {
        flashcardScores = { correct: 0, incorrect: 0, history: {} };
        localStorage.removeItem('sdp_flashcard_scores');
        updateScoreUI();
        activeFlashcardIndex = 0;
        displayActiveFlashcard();
    });
}

function displayActiveFlashcard() {
    const cardElement = document.getElementById('flashcard');
    const questionEl = document.getElementById('card-question');
    const answerEl = document.getElementById('card-answer');
    const counterEl = document.getElementById('card-counter');
    const progressBar = document.getElementById('quiz-progress');

    cardElement.classList.remove('flipped');

    // Reset scroll positions of both faces
    cardElement.querySelectorAll('.card-content-scroll').forEach(container => {
        container.scrollTop = 0;
    });

    if (activeCards.length === 0) {
        questionEl.innerHTML = '<h3>No cards found</h3>';
        answerEl.innerText = '';
        counterEl.innerText = 'Card 0 of 0';
        progressBar.style.width = '0%';
        return;
    }

    setTimeout(() => {
        const currentCard = activeCards[activeFlashcardIndex];
        // Render html inside cards
        questionEl.innerHTML = currentCard.question;
        answerEl.innerHTML = currentCard.answer;
        counterEl.innerText = `Card ${activeFlashcardIndex + 1} of ${activeCards.length}`;

        const percent = ((activeFlashcardIndex + 1) / activeCards.length) * 100;
        progressBar.style.width = `${percent}%`;
    }, 150);
}

function registerScore(isCorrect) {
    if (activeCards.length === 0) return;

    // Create unique key based on active deck and card index
    const deckName = deckSelect.value === 'all' ? 'all' : flashcardsData.decks[parseInt(deckSelect.value)].name;
    const cardId = `deck_${deckName}_idx_${activeFlashcardIndex}`;
    const prevAnswer = flashcardScores.history[cardId];

    if (isCorrect) {
        if (prevAnswer !== 'correct') {
            if (prevAnswer === 'incorrect') flashcardScores.incorrect--;
            flashcardScores.correct++;
            flashcardScores.history[cardId] = 'correct';
        }
    } else {
        if (prevAnswer !== 'incorrect') {
            if (prevAnswer === 'correct') flashcardScores.correct--;
            flashcardScores.incorrect++;
            flashcardScores.history[cardId] = 'incorrect';
        }
    }

    localStorage.setItem('sdp_flashcard_scores', JSON.stringify(flashcardScores));
    updateScoreUI();

    const cardElement = document.getElementById('flashcard');
    if (!isCorrect && !cardElement.classList.contains('flipped')) {
        cardElement.classList.add('flipped');
        setTimeout(() => {
            activeFlashcardIndex = (activeFlashcardIndex + 1) % activeCards.length;
            displayActiveFlashcard();
        }, 3000);
    } else {
        setTimeout(() => {
            activeFlashcardIndex = (activeFlashcardIndex + 1) % activeCards.length;
            displayActiveFlashcard();
        }, 400);
    }
}

function updateScoreUI() {
    document.getElementById('correct-count').innerText = flashcardScores.correct;
    document.getElementById('incorrect-count').innerText = flashcardScores.incorrect;
}

// ----------------------------------------------------
// INIT BOOTSTRAP
// ----------------------------------------------------
window.onload = init;
