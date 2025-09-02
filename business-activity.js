(function() {
    'use strict';
  
    /**
     * Debounce function to limit how often a function is called
     * @param {Function} func - The function to debounce
     * @param {number} wait - The time to wait in milliseconds
     * @return {Function} - The debounced function
     */
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  
    // ─── Configuration ─────────────────────────────────────────────
    const PER_PAGE = 20; // Increased to 20 items per page for infinite scroll
    const SUPABASE_URL = 'https://bwommjnbmumvgtlyfddn.supabase.co';
    const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ3b21tam5ibXVtdmd0bHlmZGRuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk0NDM0NTAsImV4cCI6MjA2NTAxOTQ1MH0.1OxopB9p-yoGoYpY7AUyHs-T7Fe0cK2dUjFq_FbCL-I';
  
    // ─── State Management ──────────────────────────────────────────
    // Centralized state for the component
    const state = {
      currentPage: 1,
      currentCategory: '',
      currentGroup: '',
      searchTerm: '',
      columnFilters: '',
      savedItems: [], // Array to store saved/bookmarked items
      thirdPartyApproval: false, // Toggle for third party approval filter
      selectedThirdParties: [], // Array of selected third party filters
    };
    
    window.state = state;
    window.applyColumnFilters = applyColumnFilters;
  
    // ─── Supabase Client & Cache ───────────────────────────────────
    // Note: Using a dynamic import for the Supabase client.
    let supabase;
    const cache = {
      data: {},
      set: function(key, data, count) {
        this.data[key] = { data, count, timestamp: Date.now() };
      },
      get: function(key) {
        const entry = this.data[key];
        if (!entry) return null;
        // Cache expires after 5 minutes
        if (Date.now() - entry.timestamp > 5 * 60 * 1000) {
          delete this.data[key];
          return null;
        }
        return entry;
      },
      clear: function() {
        this.data = {};
      }
    };
  
    // ─── DOM Element References ────────────────────────────────────
    // Grouping all DOM selectors for easy management.
    const dom = {
      tableEl: document.querySelector('table.table_component, #bal-table'),
      tableBodyEl: document.querySelector('table.table_component tbody.table_body, #bal-table .table_body'),
      categoryContainers: document.querySelectorAll('.bal-category-lists'),
      categoryItems: document.querySelectorAll('.bal-cat-item'),
      // Main search elements
      searchForm: document.querySelector('#wf-form-searchInput, form[name="wf-form-searchInput"]'),
      searchEl: document.querySelector('#search-input, .bal-search-input, input[type="search"], #global-search, .search-input'),
      searchSubmitBtn: document.querySelector('.bal-search-submit, .bal-search svg, .bal-search-submit svg'),
      // Column search elements
      activeGroupSpan: document.querySelector('.active-group'),
      columnToggleBtn: document.querySelector('.bal-colum-show-btn'),
      columnDropdown: document.querySelector('.bal-colum-dropdown-wrapper'),
      columnItems: document.querySelectorAll('.bal-column-item'),
      searchButtons: document.querySelectorAll('.btn-search'),
      clearButtons: document.querySelectorAll('.btn-clear'),
      categoryTab: document.querySelector('[data-w-tab="Tab 1"]'),
      groupTab: document.querySelector('[data-w-tab="Tab 2"]'),
      // Saved items table elements
      savedTable: document.querySelector('.bal-table-saved, #saved_list_table'),
      savedTableBody: document.querySelector('.bal-table-saved-tbody, #saved_list_table tbody, .bal-table-saved tbody'),
      savedItemsCount: document.querySelectorAll('.saved-items-count, .saved-count'),
      // Third party approval elements
      thirdPartyToggle: document.querySelector('#select_all'),
      thirdPartyDropdown: document.querySelector('.third-party-approval'),
      thirdPartyCheckboxes: document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]'),
      unselectAllBtn: document.querySelector('.unselect-all'),
      resetBtn: document.querySelector('.reset-item'),
    };
  
        // ─── Utility Functions ─────────────────────────────────────────

    function createLoader() {
      const loaderContainer = document.createElement('div');
      loaderContainer.className = 'loader-container';
      loaderContainer.style.cssText = 'display:flex; justify-content:center; align-items:center; width:100%; padding:40px 0;';
      const loader = document.createElement('div');
      loader.className = 'loader';
      loader.style.cssText = 'border:5px solid rgba(5,102,51,0.2); border-top-color:#056633; border-radius:50%; width:50px; height:50px; animation:spin 1s linear infinite;';
      // Styles are now in the main stylesheet
      loaderContainer.appendChild(loader);
      return loaderContainer;
    }

    function closeAccordionOnMobile() {
      // Only close accordion on iPad and smaller devices (768px and below)
      if (window.innerWidth > 820) return;
      
      const accordionWrapper = document.querySelector('.f-accordian-wrapper.activity');
      if (!accordionWrapper) return;
      
      const dropdown = accordionWrapper.querySelector('.f-accordian-dropdown');
      const toggle = accordionWrapper.querySelector('.f-accordian-toggle');
      const list = accordionWrapper.querySelector('.f-accordian-list');
      const icon = accordionWrapper.querySelector('.f-accordian-icon');
      
      if (!dropdown || !toggle || !list) return;
      
      // Get current height before starting animation
      const currentHeight = list.scrollHeight;
      
      // Ensure list has transition for smooth animation
      list.style.transition = 'height 0.3s ease, opacity 0.3s ease';
      list.style.overflow = 'hidden';
      
      // Set initial height to current height to enable transition
      list.style.height = currentHeight + 'px';
      
      // Force a reflow to ensure the height is set
      list.offsetHeight;
      
      // Start the closing animation
      requestAnimationFrame(() => {
        // Animate list closing
        list.style.height = '0px';
        list.style.opacity = '0.5';
        
        // Animate icon rotation with smooth transition
        if (icon) {
          icon.style.transition = 'transform 0.3s ease, color 0.3s ease';
          icon.style.transform = 'translate3d(0px, 0px, 0px) scale3d(1, 1, 1) rotateX(0deg) rotateY(0deg) rotateZ(0deg) skew(0deg, 0deg)';
          icon.style.color = 'rgb(107, 112, 148)'; // Reset to closed state color
        }
      });
      
      // After animation completes, clean up classes and attributes
      setTimeout(() => {
        dropdown.classList.remove('w--open');
        toggle.classList.remove('w--open');
        list.classList.remove('w--open');
        
        // Update ARIA attributes
        toggle.setAttribute('aria-expanded', 'false');
        
        // Reset opacity and remove transition to match Webflow behavior
        list.style.opacity = '';
        list.style.transition = '';
        list.style.overflow = '';
      }, 300); // Match transition duration
    }
  
    function showLoader() {
      const existingLoader = dom.tableBodyEl.querySelector('.loader-container');
      if (existingLoader) existingLoader.remove();
      dom.tableBodyEl.innerHTML = '';
      
      // Create a table row with a cell that spans all columns for the loader
      const loaderRow = document.createElement('tr');
      loaderRow.className = 'table_row';
      const loaderCell = document.createElement('td');
      loaderCell.colSpan = 9; // Adjusted for all columns
      loaderCell.className = 'table_cell';
      loaderCell.appendChild(createLoader());
      loaderRow.appendChild(loaderCell);
      
      dom.tableBodyEl.appendChild(loaderRow);
    }
  
    function hideLoader() {
      const loaderRow = dom.tableBodyEl.querySelector('.loader-container');
      if (loaderRow) {
        const parentRow = loaderRow.closest('tr');
        if (parentRow) parentRow.remove();
        else loaderRow.remove();
      }
    }
  
    function updateActiveGroupDisplay() {
      if (dom.activeGroupSpan) {
        const displayText = state.currentCategory || 'All Categories';
        dom.activeGroupSpan.textContent = displayText;
      }
    }

    function updateAccordionTitle() {
      const accordionTitle = document.querySelector('.f-accordian-title');
      if (accordionTitle) {
        const displayText = state.currentCategory || 'All Categories';
        accordionTitle.textContent = displayText;
      }
    }
  
    // ─── Modal Logic ───────────────────────────────────────────────
    // Modal functionality is now handled by the new implementation
  
    // ─── Category Filtering Logic (Refactored) ─────────────────────
  
        // Fetch unique groups from the API
    async function fetchGroups() {
("Fetching unique groups...");
      
      try {
        // Query Supabase for unique groups
        const { data, error } = await supabase
          .from('Activity List')
          .select('Group')
          .not('Group', 'is', null);
        
        if (error) {
          // console.error("Error fetching groups:", error);
          return [];
        }
        
        // Extract unique groups and sort them
        const groups = Array.from(new Set(data.map(item => item['Group']))).filter(Boolean).sort();
        
        // Debug the data structure
  ("First few group items:", data.slice(0, 3));
  (`Found ${groups.length} unique groups:`, groups);
        
        return groups;
      } catch (error) {
        // console.error("Error in fetchGroups:", error);
        return [];
      }
    }
    
    // Populate group buttons in the category lists
    function populateGroupButtons(groups) {
("Populating group buttons...");
      
      // Try multiple selectors to find the group container
      const selectors = [
        // Tab 2 container with bal-category-lists inside
        '#w-tabs-0-data-w-pane-1 .bal-category-lists',
        // Direct selector from user's HTML
        'div[data-w-tab="Tab 2"] .bal-category-lists',
        // Any tab pane that is active
        '.w-tab-pane.w--tab-active .bal-category-lists',
        // Any bal-category-lists
        '.bal-category-lists'
      ];
      
      let groupContainer = null;
      
      // Try each selector
      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (container) {
    (`Found group container with selector: ${selector}`);
          groupContainer = container;
          break;
        } else {
    (`No container found with selector: ${selector}`);
        }
      }
      
      if (!groupContainer) {
        // console.warn("Group container not found with any selector");
        
        // Debug: Log all potential containers
  ("All available tab panes:");
        document.querySelectorAll('.w-tab-pane').forEach((pane, i) => {
    (`Tab pane ${i}:`, pane.id, pane.className);
        });
        
  ("All available category lists:");
        document.querySelectorAll('.bal-category-lists').forEach((list, i) => {
    (`Category list ${i}:`, list.parentElement?.id, list.parentElement?.className);
        });
        
        return;
      }
      
("Group container found:", groupContainer);
      
      // Clear existing items except the "All Groups" button
      clearExistingItems(groupContainer, 'All Groups');
      
      // Add each group as a button
      groups.forEach(group => {
        const button = document.createElement('a');
        button.href = '#';
        
        // Check if this group is currently active
        const isActive = group === state.currentGroup;
        button.className = isActive ? 'bal-cat-item is-active w-button' : 'bal-cat-item w-button';
        
        button.textContent = group;
        button.dataset.filterType = 'group';
        button.dataset.filterValue = group;
        
        // Add click event
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          
    (`Group button clicked: ${group}`);
          
          // Apply filter immediately
          state.currentGroup = group;
          state.currentCategory = ''; // Reset category when changing group
          
          // Update active state for all buttons immediately
          document.querySelectorAll('.bal-cat-item').forEach(item => {
            item.classList.remove('is-active');
          });
          button.classList.add('is-active');
          
          // Refresh data
          state.currentPage = 1;
          renderPage(1);
        });
        
        groupContainer.appendChild(button);
        
        // Log if this button is active
        if (isActive) {
    (`Set active state for group: ${group}`);
        }
      });
      
      // Make sure the "All Groups" button has the correct event handler
      const allGroupsButton = Array.from(groupContainer.querySelectorAll('.bal-cat-item')).find(
        button => button.textContent === 'All Groups'
      );
      
      if (allGroupsButton) {
        allGroupsButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          
    ("All Groups button clicked");
          
          // Clear filter immediately
          state.currentGroup = '';
          state.currentCategory = ''; // Reset category as well
          
          // Update active state immediately
          document.querySelectorAll('.bal-cat-item').forEach(item => {
            item.classList.remove('is-active');
          });
          allGroupsButton.classList.add('is-active');
          
          // Refresh data
          state.currentPage = 1;
          renderPage(1);
        });
        
        // Set initial active state based on current group filter
        if (!state.currentGroup) {
    ("Setting 'All Groups' as active (no current group)");
          allGroupsButton.classList.add('is-active');
        } else {
    ("'All Groups' not active, current group is:", state.currentGroup);
          allGroupsButton.classList.remove('is-active');
        }
      } else {
        // console.warn("All Groups button not found");
      }
      
(`Added ${groups.length} group buttons to container:`, groupContainer);
    }
  
    async function initCategoryRadios() {
      try {
  ("Initializing categories and groups...");
        
        // Debug: Log all elements with class bal-category-lists
  ("Finding all bal-category-lists elements:");
        const allCategoryLists = document.querySelectorAll('.bal-category-lists');
  (`Found ${allCategoryLists.length} bal-category-lists elements`);
        
        allCategoryLists.forEach((list, index) => {
    (`List ${index}:`, {
            parent: list.parentElement?.tagName,
            parentId: list.parentElement?.id,
            parentClass: list.parentElement?.className,
            children: list.children.length,
            html: list.outerHTML.substring(0, 100) + '...'
          });
        });
        
        // Debug: Log all tab panes
  ("Finding all tab panes:");
        const allTabPanes = document.querySelectorAll('.w-tab-pane');
  (`Found ${allTabPanes.length} tab panes`);
        
        allTabPanes.forEach((pane, index) => {
    (`Tab pane ${index}:`, {
            id: pane.id,
            class: pane.className,
            dataWTab: pane.getAttribute('data-w-tab'),
            children: pane.children.length,
            html: pane.outerHTML.substring(0, 100) + '...'
          });
        });
        
        // Fetch groups from API
        const groups = await fetchGroups();
        
        if (groups.length > 0) {
          // Try to populate group buttons with a delay to ensure DOM is ready
          setTimeout(() => {
      ("Attempting to populate group buttons after delay...");
            populateGroupButtons(groups);
          }, 500);
          
          // Also try immediately in case DOM is already ready
          populateGroupButtons(groups);
        } else {
          // console.warn("No groups found in the database");
        }
        
        // Fetch all unique categories and groups from the database
        const { data, error } = await supabase.from('Activity List').select('Category, Group');
        if (error) {
          // console.error("Error fetching categories:", error);
          return;
        }
  
        // Extract unique categories
        const dbCategories = Array.from(new Set(data.map(r => r.Category).filter(Boolean))).sort();
        
  (`Found ${dbCategories.length} categories`);
        
        // Populate category tabs
        populateCategoryTabs(dbCategories, []);
        
        // Setup event listeners for category items
        setupCategoryEventListeners();
        
      } catch (error) {
        // console.error("Error in initCategoryRadios:", error);
      }
    }
  
    function populateCategoryTabs(categories, groups) {
      // Find the category container
      const categoryContainer = document.querySelector('.bal-category-lists:nth-child(1)');
      
      if (!categoryContainer) {
        // console.warn("Category container not found");
        return;
      }
      
("Populating category tabs...");
      
      // Clear existing items except the "All" items
      clearExistingItems(categoryContainer, 'All Categories');
      
      // Add category items
      categories.forEach(category => {
        addCategoryItem(categoryContainer, category, 'category');
      });
      
("Category tabs populated");
    }
    
    function clearExistingItems(container, keepText) {
      if (!container) {
        // console.warn("Cannot clear items: container is null or undefined");
        return;
      }
      
(`Clearing items in container, keeping "${keepText}"...`);
      
      // Keep the "All" item and remove others
      const items = Array.from(container.querySelectorAll('.bal-cat-item'));
(`Found ${items.length} items to process`);
      
      // Keep only the first "All" item
      let foundAll = false;
      let removedCount = 0;
      
      items.forEach(item => {
        const itemText = item.textContent.trim();
        
        if (itemText === keepText) {
          if (!foundAll) {
      (`Keeping "${keepText}" item`);
            foundAll = true;
            return; // Keep this one
          }
        }
        
        // Remove all other items
  (`Removing item: "${itemText}"`);
        item.remove();
        removedCount++;
      });
      
(`Removed ${removedCount} items, kept ${foundAll ? 1 : 0} "${keepText}" items`);
      
      // If we didn't find the "All" item, create it
      if (!foundAll) {
  (`Creating new "${keepText}" item`);
        const allItem = document.createElement('a');
        allItem.href = '#';
        allItem.className = 'bal-cat-item is-active w-button';
        allItem.textContent = keepText;
        container.appendChild(allItem);
      }
    }
    
    function addCategoryItem(container, text, type) {
      // Create a new category/group item
      const item = document.createElement('a');
      item.href = '#';
      item.className = 'bal-cat-item w-button';
      item.textContent = text;
      item.dataset.filterType = type;
      item.dataset.filterValue = text;
      
      // Add to container
      container.appendChild(item);
    }
  
    function setupCategoryEventListeners() {
("Setting up category event listeners");
      
      // Handle clicks on category items
      document.querySelectorAll('.bal-cat-item').forEach(item => {
        item.addEventListener('click', (event) => {
          event.preventDefault();
          
          const filterType = item.dataset.filterType || 'category';
          const filterValue = item.textContent.trim();
          
          // Handle "All" items
          const isAll = filterValue === 'All Categories' || filterValue === 'All Groups';
          const newValue = isAll ? '' : filterValue;
          
    (`Category item clicked: ${filterValue} (${filterType}), isAll: ${isAll}`);
          
          if (filterType === 'group') {
            handleGroupChange(newValue);
          } else {
            handleCategoryChange(newValue);
          }
        });
      });
      
      // Handle tab switching
      if (dom.categoryTab && dom.groupTab) {
        dom.categoryTab.addEventListener('click', () => {
    ("Category tab clicked");
          // Reset to category filtering when switching to category tab
          state.currentGroup = '';
        });
        
        dom.groupTab.addEventListener('click', () => {
    ("Group tab clicked");
          // Reset to group filtering when switching to group tab
          state.currentCategory = '';
        });
      }
    }
  
    function handleCategoryChange(newCategory) {
      if (state.currentCategory === newCategory) return;
      
(`Changing category to: "${newCategory || 'All'}"`);
      
      state.currentCategory = newCategory;
      state.currentGroup = ''; // Reset group when changing category
      
      updateActiveCategoryClass();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      renderPage(1);
    }
    
    function handleGroupChange(newGroup) {
      if (state.currentGroup === newGroup) return;
      
(`Changing group to: "${newGroup || 'All'}"`);
      
      state.currentGroup = newGroup;
      state.currentCategory = ''; // Reset category when changing group
      
      updateActiveCategoryClass();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      renderPage(1);
    }
  
    function updateActiveCategoryClass() {
("Updating active classes for all category/group items");
("Current state:", {
        currentCategory: state.currentCategory,
        currentGroup: state.currentGroup
      });
      
      // Update active class for category items
      document.querySelectorAll('.bal-cat-item').forEach(item => {
        const filterType = item.dataset.filterType || 'category';
        const filterValue = item.textContent.trim();
        const isAll = filterValue === 'All Categories' || filterValue === 'All Groups';
        
        if (filterType === 'category') {
          // For category items
          const isActive = isAll ? state.currentCategory === '' : filterValue === state.currentCategory;
          toggleActiveClass(item, isActive);
          
          if (isActive) {
      (`Set active category: ${isAll ? 'All Categories' : filterValue}`);
          }
        } else {
          // For group items
          const isActive = isAll ? state.currentGroup === '' : filterValue === state.currentGroup;
          toggleActiveClass(item, isActive);
          
          if (isActive) {
      (`Set active group: ${isAll ? 'All Groups' : filterValue}`);
          }
        }
      });
    }
    
    function toggleActiveClass(element, isActive) {
      if (isActive) {
        element.classList.add('is-active');
          } else {
        element.classList.remove('is-active');
          }
    }
  
    // ─── Data Fetching & Rendering ──────────────────────────────────
  
    async function renderPage(page = 1, append = false) {
      // Expose renderPage to window for direct access from event handlers
      window.renderPage = renderPage;
(`Rendering page ${page}... (append: ${append})`);
      
      // Only show loader for first page or when not appending
      if (!append) {
      showLoader();
      } else {
        // Show a loading indicator at the bottom for infinite scroll
        showBottomLoader();
      }
      
      state.currentPage = page;
        const { currentCategory, currentGroup, searchTerm, columnFilters, thirdPartyApproval, selectedThirdParties } = state;
  
        const cacheKey = `${currentCategory}|${currentGroup}|${searchTerm}|${columnFilters}|${thirdPartyApproval}|${selectedThirdParties.join(',')}|${page}`;
("Cache key:", cacheKey);
      
      const cachedResult = cache.get(cacheKey);
      if (cachedResult) {
  ("Using cached data:", cachedResult);
        renderResults(cachedResult.data, page, cachedResult.count, append);
        return;
      }
  
("No cache found, fetching from Supabase...");
("Filters:", { currentCategory, currentGroup, searchTerm, columnFilters });
  
      try {
      let query = supabase.from('Activity List').select('*', { count: 'exact' });
  ("Base query created");
  
      // Apply category filter
      if (currentCategory) {
    (`Applying category filter: ${currentCategory}`);
        query = query.eq('Category', currentCategory);
      }
        
        // Apply group filter
        if (currentGroup) {
    (`Applying group filter: ${currentGroup}`);
          query = query.eq('Group', currentGroup);
      }
      
      // Apply global search filter
      if (searchTerm) {
    (`Applying global search: ${searchTerm}`);
        query = query.or(`"Activity Name".ilike.%${searchTerm}%,Code.ilike.%${searchTerm}%,النشاط.ilike.%${searchTerm}%`);
      }
      
      // Apply third party approval filter if enabled
      if (thirdPartyApproval) {
  ("Applying third party approval filter");
        query = query.not('Third Party', 'is', null);
      }
      
      // Apply specific third party filters if any are selected
      if (selectedThirdParties.length > 0) {
  (`Filtering by specific third parties: ${selectedThirdParties.join(', ')}`);
        query = query.in('Third Party', selectedThirdParties);
      }
      
      // Apply column-specific filters
      if (columnFilters) {
  (`Applying column filters: ${columnFilters}`);
  ("Column filters type:", typeof columnFilters);
        
        const filterParts = columnFilters.split(',');
  (`Split into ${filterParts.length} filter parts:`, filterParts);
        
        filterParts.forEach((filter, index) => {
    (`Processing filter part ${index}: "${filter}"`);
          
          // Check if it's a simple filter or an OR condition
          if ((filter.includes('.ilike.') || filter.includes('.eq.')) && !filter.includes(',')) {
            // Simple filter - determine operator type
            let operator, field, value;
            if (filter.includes('.ilike.')) {
              [field, value] = filter.split('.ilike.');
              operator = 'ilike';
            } else if (filter.includes('.eq.')) {
              [field, value] = filter.split('.eq.');
              operator = 'eq';
            }
            
      (`Adding ${operator} filter: field="${field}", value="${value}"`);
            
            try {
              // For ilike filters, decode the value in case it was double-encoded
              let processedValue = value;
              if (operator === 'ilike') {
                try {
                  // If the value contains encoded characters, decode them
                  if (value.includes('%25')) {
                    processedValue = decodeURIComponent(value);
                  }
                } catch (decodeError) {
                  // If decoding fails, use the original value
                  processedValue = value;
                }
              }
              
              // Handle quoted field names properly
              if (field.startsWith('"') && field.endsWith('"')) {
                // Field name is already quoted
                if (operator === 'ilike') {
                  query = query.ilike(field, processedValue);
                } else {
                  query = query.eq(field, processedValue);
                }
          (`Applied ${operator} filter with quoted field: ${field}, value: ${processedValue}`);
              } else if (field.includes(' ')) {
                // Field name contains spaces but is not quoted
                const quotedField = `"${field}"`;
                if (operator === 'ilike') {
                  query = query.ilike(quotedField, processedValue);
                } else {
                  query = query.eq(quotedField, processedValue);
                }
          (`Applied ${operator} filter with auto-quoted field: ${quotedField}, value: ${processedValue}`);
              } else {
                // Normal field name
                if (operator === 'ilike') {
                  query = query.ilike(field, processedValue);
                } else {
                  query = query.eq(field, processedValue);
                }
          (`Applied ${operator} filter with regular field: ${field}, value: ${processedValue}`);
              }
            } catch (filterError) {
              // console.error(`Error applying ${operator} filter for "${field}":`, filterError);
            }
          } else if (filter.includes(',')) {
            // OR condition
      (`Adding OR filter: ${filter}`);
            try {
            query = query.or(filter);
        ("OR filter applied successfully");
            } catch (orError) {
              // console.error(`Error applying OR filter for "${filter}":`, orError);
            }
          } else {
            // console.warn(`Unrecognized filter format: "${filter}"`);
          }
        });
      }
  
      const from = (page - 1) * PER_PAGE;
      const to = from + PER_PAGE - 1;
      query = query.order('Code', { ascending: true }).range(from, to);
  (`Range: ${from} to ${to}`);
  
  ("Executing query...");
      try {
  ("Query details:", {
          url: SUPABASE_URL,
          hasSupabase: !!supabase,
          queryObject: query,
          filters: {
            category: currentCategory,
            group: currentGroup,
            search: searchTerm,
            columnFilters,
            thirdPartyApproval,
            selectedThirdParties
          }
        });
  
      const { data, error, count } = await query;
  ("Query response:", { 
          hasData: !!data, 
          dataLength: data ? data.length : 0, 
          hasError: !!error, 
          count 
        });
      
      if (error) {
          // console.error("Supabase query error:", error);
        hideLoader();
          hideBottomLoader();
          return; // Exit early on error
        } else {
          // Continue with the data we have
          if (data && data.length > 0) {
            // Cache the result
            cache.set(cacheKey, data, count);
            // Render the results
            renderResults(data, page, count, append);
          } else {
      ("No data returned from query");
            renderResults([], page, 0, append);
          }
          return;
        }
      } catch (queryError) {
        // console.error("Exception during Supabase query execution:", queryError);
        // console.error(queryError.stack);
        hideLoader();
        hideBottomLoader();
          
          // Only show error if not appending (don't replace existing content)
          if (!append) {
        const errorRow = document.createElement('tr');
        errorRow.className = 'table_row';
        const errorCell = document.createElement('td');
        errorCell.colSpan = 9; // Adjusted for all columns
        errorCell.className = 'table_cell';
            errorCell.textContent = 'Error loading data. Please try again later.';
        errorCell.style.textAlign = 'center';
        errorCell.style.padding = '20px';
        errorRow.appendChild(errorCell);
        dom.tableBodyEl.innerHTML = '';
        dom.tableBodyEl.appendChild(errorRow);
          }
        return;
      }
        
  (`Query successful. Got ${data?.length || 0} results out of ${count || 0} total.`);
        if (data && data.length > 0) {
    ("First item sample:", data[0]);
      }
      
      cache.set(cacheKey, data, count);
        renderResults(data, page, count, append);
      } catch (err) {
        // console.error("Error in renderPage:", err);
        // console.error(err.stack);
        hideLoader();
        hideBottomLoader();
        
        // Only show error if not appending
        if (!append) {
          const errorRow = document.createElement('tr');
          errorRow.className = 'table_row';
          const errorCell = document.createElement('td');
          errorCell.colSpan = 9; // Adjusted for all columns
          errorCell.className = 'table_cell';
          errorCell.textContent = 'An unexpected error occurred. Please try again later.';
          errorCell.style.textAlign = 'center';
          errorCell.style.padding = '20px';
          errorRow.appendChild(errorCell);
          dom.tableBodyEl.innerHTML = '';
          dom.tableBodyEl.appendChild(errorRow);
        }
      }
    }
    
    // Show a loader at the bottom of the table for infinite scroll
    function showBottomLoader() {
      // Remove any existing bottom loader
      hideBottomLoader();
      
      // Create a loader row at the bottom
      const loaderRow = document.createElement('tr');
      loaderRow.className = 'table_row bottom-loader-row';
      const loaderCell = document.createElement('td');
      loaderCell.colSpan = 9; // Adjusted for all columns
      loaderCell.className = 'table_cell';
      loaderCell.appendChild(createLoader());
      loaderRow.appendChild(loaderCell);
      
      // Append to the table body
      if (dom.tableBodyEl) {
        dom.tableBodyEl.appendChild(loaderRow);
      }
    }
    
    // Hide the bottom loader
    function hideBottomLoader() {
      const loaderRow = dom.tableBodyEl?.querySelector('.bottom-loader-row');
      if (loaderRow) {
        loaderRow.remove();
      }
    }
  
    function renderResults(data, page, count, append = false) {
(`Rendering results for page ${page}, count: ${count}, append: ${append}`);
      hideLoader();
      hideBottomLoader();
      
      // Verify tableBodyEl is still valid
      if (!dom.tableBodyEl) {
        // console.error("Table body element is missing when trying to render results");
        return;
      }
      
      // Only clear the table if not appending
      if (!append) {
  ("Clearing table body");
      dom.tableBodyEl.innerHTML = '';
      } else {
  ("Appending to existing table content");
      }
  
      if (data?.length > 0) {
  (`Creating ${data.length} rows`);
        data.forEach((item, index) => {
    (`Creating row ${index + 1}/${data.length}`);
          const row = document.createElement('tr');
          row.className = 'table_row';
          
          // Create cells for each column
          // Code column
          const codeCell = document.createElement('td');
          codeCell.className = 'table_cell';
          codeCell.textContent = item.Code || '';
          row.appendChild(codeCell);
          
          // Group column
          const groupCell = document.createElement('td');
          groupCell.className = 'table_cell';
          groupCell.textContent = item.Group || '';
          row.appendChild(groupCell);
          
          // Category column
          const categoryCell = document.createElement('td');
          categoryCell.className = 'table_cell';
          categoryCell.textContent = item.Category || '';
          row.appendChild(categoryCell);
          
          // Activity Name column with icons
          const nameCell = document.createElement('td');
          nameCell.className = 'table_cell';
          
          const nameDiv = document.createElement('div');
          nameDiv.className = 'bal-table-td-div';
          
          const nameText = document.createElement('p');
          nameText.className = 'td-text';
          nameText.textContent = item['Activity Name'] || '';
          nameDiv.appendChild(nameText);
          
          // Add icons container
          const iconsDiv = document.createElement('div');
          iconsDiv.className = 'bal-name-td-icons';
          
          // Copy button
          const copyBtnDiv = document.createElement('div');
          copyBtnDiv.className = 'code-embed-150 w-embed';
          const copyButton = document.createElement('button');
          copyButton.type = 'submit';
          copyButton.className = 'btn-copy';
          copyButton.setAttribute('aria-label', 'Copy');
          copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="13" viewBox="0 0 10 13" fill="none">
  <path d="M5.5 10.5C6.1628 10.4992 6.79822 10.2356 7.26689 9.7669C7.73556 9.29823 7.99921 8.66281 8 8.00001V3.62151C8.00078 3.35869 7.94938 3.09833 7.84879 2.85552C7.7482 2.61271 7.60041 2.39228 7.414 2.20701L6.293 1.08601C6.10773 0.899596 5.8873 0.75181 5.64449 0.651219C5.40168 0.550627 5.14132 0.499231 4.8785 0.500009H2.5C1.8372 0.500803 1.20178 0.76445 0.73311 1.23312C0.264441 1.70179 0.000793929 2.33721 0 3.00001V8.00001C0.000793929 8.66281 0.264441 9.29823 0.73311 9.7669C1.20178 10.2356 1.8372 10.4992 2.5 10.5H5.5ZM1 8.00001V3.00001C1 2.60218 1.15804 2.22065 1.43934 1.93935C1.72064 1.65804 2.10218 1.50001 2.5 1.50001C2.5 1.50001 4.9595 1.50701 5 1.51201V2.50001C5 2.76523 5.10536 3.01958 5.29289 3.20712C5.48043 3.39465 5.73478 3.50001 6 3.50001H6.988C6.993 3.54051 7 8.00001 7 8.00001C7 8.39783 6.84196 8.77936 6.56066 9.06067C6.27936 9.34197 5.89782 9.50001 5.5 9.50001H2.5C2.10218 9.50001 1.72064 9.34197 1.43934 9.06067C1.15804 8.77936 1 8.39783 1 8.00001ZM10 4.50001V10C9.99921 10.6628 9.73556 11.2982 9.26689 11.7669C8.79822 12.2356 8.1628 12.4992 7.5 12.5H3C2.86739 12.5 2.74021 12.4473 2.64645 12.3536C2.55268 12.2598 2.5 12.1326 2.5 12C2.5 11.8674 2.55268 11.7402 2.64645 11.6465C2.74021 11.5527 2.86739 11.5 3 11.5H7.5C7.89782 11.5 8.27936 11.342 8.56066 11.0607C8.84196 10.7794 9 10.3978 9 10V4.50001C9 4.3674 9.05268 4.24022 9.14645 4.14646C9.24021 4.05269 9.36739 4.00001 9.5 4.00001C9.63261 4.00001 9.75979 4.05269 9.85355 4.14646C9.94732 4.24022 10 4.3674 10 4.50001Z" fill="black" fill-opacity="0.6"/>
            </svg>`;
          
          // Add click event to copy activity name
          copyButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent row click
            const textToCopy = item['Activity Name'] || '';
            navigator.clipboard.writeText(textToCopy)
              .then(() => {
                // Show feedback
                const originalColor = copyButton.style.color;
                copyButton.style.color = '#056633'; // Success color
                setTimeout(() => {
                  copyButton.style.color = originalColor;
                }, 1000);
              })
              .catch(err => {
                // console.error('Failed to copy text: ', err);
              });
          });
          
          copyBtnDiv.appendChild(copyButton);
          
          // Save button
          const saveBtnDiv = document.createElement('div');
          saveBtnDiv.className = 'code-embed-150 w-embed';
          const saveButton = document.createElement('button');
          saveButton.type = 'submit';
          saveButton.className = 'btn-save';
          saveButton.setAttribute('aria-label', 'Save');
          saveButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="13" viewBox="0 0 11 13" fill="none">
  <path d="M8.49902 1.05273L8.69727 1.0625C9.15499 1.10845 9.58495 1.31153 9.91309 1.63965C10.2412 1.96777 10.4443 2.39776 10.4902 2.85547L10.5 3.05371V10.9482C10.5022 11.1444 10.4455 11.3367 10.3369 11.5C10.2281 11.6635 10.0717 11.7906 9.88965 11.8643L9.88477 11.8662C9.76055 11.9183 9.62686 11.9448 9.49219 11.9453C9.36339 11.9449 9.23598 11.9199 9.11719 11.8701C8.99793 11.8201 8.88961 11.7464 8.79883 11.6543L8.79492 11.6514L5.85254 8.72461L5.5 8.37402L5.14746 8.72461L2.20508 11.6514L2.20117 11.6553C2.06351 11.795 1.88679 11.8897 1.69434 11.9277C1.54982 11.9562 1.40114 11.9517 1.25977 11.915L1.12109 11.8682L1.11133 11.8643L0.980469 11.7988C0.854533 11.7245 0.745917 11.6227 0.664062 11.5C0.555089 11.3366 0.497867 11.1437 0.5 10.9473V3.05371C0.500635 2.52333 0.711894 2.01469 1.08691 1.63965C1.41502 1.31155 1.84505 1.10849 2.30273 1.0625L2.50098 1.05273H8.49902Z" stroke="#06603A"/>
            </svg>`;
          
          // Add click event to save/bookmark activity
          saveButton.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevent row click
            toggleSavedItem(item, saveButton, row);
          });
          
          // Check if this activity is already saved
          if (isItemSaved(item.Code)) {
            saveButton.classList.add('saved');
            saveButton.querySelector('svg path').setAttribute('stroke', '#06603A');
            row.classList.add('is-saved'); // Also mark the row as saved
          }
          
          saveBtnDiv.appendChild(saveButton);
          
          iconsDiv.appendChild(copyBtnDiv);
          iconsDiv.appendChild(saveBtnDiv);
          nameDiv.appendChild(iconsDiv);
          nameCell.appendChild(nameDiv);
          row.appendChild(nameCell);
          
          // Third Party column
          const thirdPartyCell = document.createElement('td');
          thirdPartyCell.className = 'table_cell';
          thirdPartyCell.textContent = item['Third Party'] || 'N/A';
          row.appendChild(thirdPartyCell);
          
          // When column
          const whenCell = document.createElement('td');
          whenCell.className = 'table_cell';
          whenCell.textContent = item['When'] || 'N/A';
          row.appendChild(whenCell);
          
          // Notes column
          const notesCell = document.createElement('td');
          notesCell.className = 'table_cell';
          notesCell.textContent = item['Notes'] || 'N/A';
          row.appendChild(notesCell);
          
          // Risk Rating column
          const riskRatingCell = document.createElement('td');
          riskRatingCell.className = 'table_cell';
          riskRatingCell.textContent = item['Risk Rating'] || 'N/A';
          row.appendChild(riskRatingCell);
          
          // DNFBP column
          const dnfbpCell = document.createElement('td');
          dnfbpCell.className = 'table_cell';
          dnfbpCell.textContent = item['DNFBP'] || 'N/A';
          row.appendChild(dnfbpCell);
          
          // Store all item data as a data attribute for modal display
          row.dataset.activityData = JSON.stringify(item);
          
          // Store activity code for reference (used for saved items sync)
          row.dataset.activityCode = item.Code;
          
          // Add click event to show modal with activity details
          row.style.cursor = 'pointer';
          row.addEventListener('click', (event) => {
            event.stopPropagation();
            showActivityDetailsModal(item);
          });
          
          dom.tableBodyEl.appendChild(row);
        });
      } else {
  ("No data to display, showing 'no results' message");
        // Create a row with a "no results" message
        const noResultsRow = document.createElement('tr');
        noResultsRow.className = 'table_row';
        const noResultsCell = document.createElement('td');
        noResultsCell.colSpan = 9; // Updated to match the total number of columns
        noResultsCell.className = 'table_cell';
        noResultsCell.textContent = 'No activities found matching your criteria.';
        noResultsCell.style.textAlign = 'center';
        noResultsCell.style.padding = '20px';
        noResultsRow.appendChild(noResultsCell);
        
        try {
        dom.tableBodyEl.appendChild(noResultsRow);
    ("No results message added to table");
        } catch (err) {
          // console.error("Error appending no results message:", err);
        }
      }
  
      state.currentPage = page;
      
      // No pagination needed for infinite scroll
    }
    
    // Helper function to show activity details in a modal
    function showActivityDetailsModal(activityData) {
      // Check if modal exists, if not create one
      let modalEl = document.querySelector('.bal-detail-popup');
      
      if (!modalEl) {
        // Create modal if it doesn't exist
        modalEl = createActivityDetailsModal();
        document.body.appendChild(modalEl);
      }
      
      // Populate modal with activity data
      populateModalWithActivityData(activityData, modalEl);
      
      // Show the modal
      modalEl.classList.add('is-open');
    }
    
    // Helper function to populate the modal with activity data
    function populateModalWithActivityData(activityData, modalEl) {
      const modalBody = modalEl.querySelector('.bal-detail-table-body');
      if (!modalBody) return;
      
      // Clear existing content
      modalBody.innerHTML = '';
      
      // Define fields to display
      const fields = [
        { key: 'Code', label: 'Code' },
        { key: 'Group', label: 'Group' },
        { key: 'Category', label: 'Category' },
        { key: 'Activity Name', label: 'Activity Name' },
        { key: 'النشاط', label: 'Arabic Name' },
        { key: 'Risk Rating', label: 'Risk Rating' },
        { key: 'Industry Risk', label: 'Industry Risk' },
        { key: 'Third Party', label: 'Third Party' },
        { key: 'When', label: 'When' },
        { key: 'Notes', label: 'Notes' },
        { key: 'DNFBP', label: 'DNFBP' }
      ];
      
      // Create rows for each field
      fields.forEach(field => {
        const value = activityData[field.key] || 'N/A';
        
        const tr = document.createElement('tr');
        tr.className = 'bal-detail-table-row';
        
        const th = document.createElement('th');
        th.className = 'bal-detail-table-cell _w-35';
        th.textContent = field.label;
        
        const td = document.createElement('td');
        td.className = 'bal-detail-table-cell _w-65';
        td.textContent = value;
        
        tr.appendChild(th);
        tr.appendChild(td);
        modalBody.appendChild(tr);
      });
    }
    
    // Helper function to create modal structure if it doesn't exist
    function createActivityDetailsModal() {
      const modalEl = document.createElement('div');
      modalEl.className = 'bal-detail-popup';
      
      // Modal overlay
      const overlay = document.createElement('div');
      overlay.className = 'bal-modal-overlay';
      overlay.addEventListener('click', () => {
        modalEl.classList.remove('is-open');
      });
      modalEl.appendChild(overlay);
      
      // Modal content wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'bal-detail-popup-wrapper';
      
      // Modal content
      const content = document.createElement('div');
      content.className = 'bal-detail-popup-content';
      
      // Close button
      const closeBtn = document.createElement('div');
      closeBtn.className = 'bal-detail-popup-close';
      closeBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M18 6L6 18M6 6L18 18" stroke="#1C1C1C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      closeBtn.addEventListener('click', () => {
        modalEl.classList.remove('is-open');
      });
      content.appendChild(closeBtn);
      
      // Modal header
      const header = document.createElement('div');
      header.className = 'bal-detail-popup-header';
      const title = document.createElement('h2');
      title.className = 'bal-detail-popup-title';
      title.textContent = 'Activity Details';
      header.appendChild(title);
      content.appendChild(header);
      
      // Modal body with table
      const body = document.createElement('div');
      body.className = 'bal-detail-popup-body';
      
      const table = document.createElement('table');
      table.className = 'bal-detail-table';
      
      const tableBody = document.createElement('tbody');
      tableBody.className = 'bal-detail-table-body';
      
      table.appendChild(tableBody);
      body.appendChild(table);
      content.appendChild(body);
      
      wrapper.appendChild(content);
      modalEl.appendChild(wrapper);
      
      return modalEl;
    }
  
    // ─── Pagination Logic ──────────────────────────────────────────
  
    function renderPagination(currentPageNum, totalCount) {
      const totalPages = Math.ceil((totalCount || 0) / PER_PAGE) || 1;
      dom.pagerEl.innerHTML = '';
      if (totalPages <= 1) return;
  
      const paginationWrapper = document.createElement('div');
      paginationWrapper.className = 'pagination_page-wrapper';
      
      const createButton = (text, page, isDisabled, isCurrent, className) => {
        const button = document.createElement('button');
        button.textContent = text;
        button.disabled = isDisabled;
        button.className = className || '';
        if (isCurrent) button.classList.add('current-page');
        button.style.cssText = 'background-color:transparent; border:none; cursor:pointer;';
        if (!isDisabled) button.onclick = () => renderPage(page);
        return button;
      };
      
      paginationWrapper.appendChild(createButton('Previous', currentPageNum - 1, currentPageNum === 1, false, 'pagination_previous'));
  
      const pageRange = 2;
      const startPage = Math.max(1, currentPageNum - pageRange);
      const endPage = Math.min(totalPages, currentPageNum + pageRange);
  
      if (startPage > 1) {
        paginationWrapper.appendChild(createButton('1', 1, false, false, ''));
        if (startPage > 2) paginationWrapper.insertAdjacentHTML('beforeend', '<span>...</span>');
      }
  
      for (let page = startPage; page <= endPage; page++) {
        paginationWrapper.appendChild(createButton(page.toString(), page, false, page === currentPageNum, ''));
      }
  
      if (endPage < totalPages) {
        if (endPage < totalPages - 1) paginationWrapper.insertAdjacentHTML('beforeend', '<span>...</span>');
        paginationWrapper.appendChild(createButton(totalPages.toString(), totalPages, false, false, ''));
      }
      
      paginationWrapper.appendChild(createButton('Next', currentPageNum + 1, currentPageNum === totalPages, false, 'pagination-next'));
      dom.pagerEl.appendChild(paginationWrapper);
    }
  
    // ─── Search Functionality ──────────────────────────────────────
  
    function setupSearch() {
("Setting up search functionality...");
      
      // Set up main search form
      if (dom.searchForm) {
  ("Search form found, setting up to prevent submission");
        
        // Find search input directly in the form
        const formSearchInput = dom.searchForm.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
        if (formSearchInput) {
    ("Search input found directly in form, setting up search-on-type");
          
          // Set up search-on-type with debounce (350ms is a good balance between responsiveness and performance)
          const handleSearchInput = debounce((event) => {
            const searchTerm = event.target.value.trim();
            
            // Update state
            state.searchTerm = searchTerm;
            
            // Reset to first page and reload data
            state.currentPage = 1;
            renderPage(1);
          }, 350);
          
          formSearchInput.addEventListener('input', handleSearchInput);
        }
        
        // Prevent form submission - use capture phase to ensure it's caught early
        dom.searchForm.addEventListener('submit', (event) => {
    ("Form submit event detected - preventing default");
          event.preventDefault();
          event.stopPropagation();
          
          // Find the search input directly within the form
          const searchInput = event.target.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
    ("Search input found within form:", !!searchInput);
          
          // Trigger search manually
          if (searchInput) {
            const searchTerm = searchInput.value.trim();
      (`Search term from form submit (direct): ${searchTerm}`);
            
            // Update state
            state.searchTerm = searchTerm;
            
            // Reset to first page and reload data
            state.currentPage = 1;
            renderPage(1);
          } else if (dom.searchEl) {
            // Fallback to dom.searchEl
            const searchTerm = dom.searchEl.value.trim();
      (`Search term from form submit (fallback): ${searchTerm}`);
            
            // Update state
            state.searchTerm = searchTerm;
            
            // Reset to first page and reload data
            state.currentPage = 1;
            renderPage(1);
          }
          
          return false; // Extra measure to prevent submission
        }, true); // Use capture phase
        
        // Also prevent default on the form itself using the onsubmit property
        dom.searchForm.onsubmit = function() {
    ("Form onsubmit triggered - preventing default");
          return false;
        };
        
        // Set up search submit button click
        if (dom.searchSubmitBtn) {
    ("Search submit button found");
          
          // Remove any existing click listeners
          const newSubmitBtn = dom.searchSubmitBtn.cloneNode(true);
          if (dom.searchSubmitBtn.parentNode) {
            dom.searchSubmitBtn.parentNode.replaceChild(newSubmitBtn, dom.searchSubmitBtn);
          }
          dom.searchSubmitBtn = newSubmitBtn;
          
          // Add new click listener
          dom.searchSubmitBtn.addEventListener('click', (event) => {
      ("Search button clicked - preventing default");
            // Prevent default behavior
            event.preventDefault();
            event.stopPropagation();
            
            // Find the closest form
            const form = event.target.closest('form');
      ("Form found from button:", !!form);
            
            // Find search input directly in the form
            let searchInput = null;
            if (form) {
              searchInput = form.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
        ("Search input found in form from button:", !!searchInput);
            }
            
            // If not found in form, try to find it near the button
            if (!searchInput) {
              const searchContainer = event.target.closest('.bal-search');
              if (searchContainer) {
                searchInput = searchContainer.querySelector('input');
          ("Search input found in container from button:", !!searchInput);
              }
            }
            
            // Trigger search manually
            if (searchInput) {
              const searchTerm = searchInput.value.trim();
        (`Search term from button click (direct): ${searchTerm}`);
              
              // Update state
              state.searchTerm = searchTerm;
              
              // Reset to first page and reload data
              state.currentPage = 1;
              renderPage(1);
            } else if (dom.searchEl) {
              // Fallback to dom.searchEl
              const searchTerm = dom.searchEl.value.trim();
        (`Search term from button click (fallback): ${searchTerm}`);
              
              // Update state
              state.searchTerm = searchTerm;
              
              // Reset to first page and reload data
              state.currentPage = 1;
              renderPage(1);
            }
            
            return false; // Extra measure to prevent submission
          }, true); // Use capture phase
        }
      }
      
      // Setup global search if available
      if (dom.searchEl) {
  ("Search input element found");
        let searchTimeout;
        dom.searchEl.addEventListener('input', () => {
          clearTimeout(searchTimeout);
          searchTimeout = setTimeout(() => {
            state.searchTerm = dom.searchEl.value.trim();
            state.currentPage = 1;
            renderPage(1);
          }, 300);
        });
    
        dom.searchEl.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            
            // Trigger search manually on Enter
            const searchTerm = dom.searchEl.value.trim();
      (`Search term from Enter key: ${searchTerm}`);
            
            // Update state
            state.searchTerm = searchTerm;
            
            // Reset to first page and reload data
            state.currentPage = 1;
            renderPage(1);
          }
        });
      }
      
      // Setup column-specific search
      setupColumnSearch();
    }
    
    function setupColumnSearch() {
      // We'll use the existing implementation for search functionality
      // No need for a global click handler as it's handled in the existing implementation
      // Store column search values in state for persistence
      if (!state.columnSearches) {
        state.columnSearches = {
        code: '',
        group: '',
        category: '',
        name: '',
          thirdParty: '',
          when: '',
          notes: '',
          riskRating: '',
          dnfbp: ''
        };
      }
      
      // Create a mapping between column names and their database fields
      const nameToFieldMapping = {
        'Code': { field: 'Code', stateKey: 'code' },
        'Group': { field: 'Group', stateKey: 'group' },
        'Category': { field: 'Category', stateKey: 'category' },
        'Activity Name': { field: 'Activity Name', stateKey: 'name' },
        'Third Party': { field: 'Third Party', stateKey: 'thirdParty' },
        'When': { field: 'When', stateKey: 'when' },
        'Notes': { field: 'Notes', stateKey: 'notes' },
        'Risk Rating': { field: 'Risk Rating', stateKey: 'riskRating' },
        'DNFBP': { field: 'DNFBP', stateKey: 'dnfbp' }
      };
      
      // Get all table headers and map them
      const tableHeaders = document.querySelectorAll('.table_header');
(`Found ${tableHeaders.length} table headers`);
      
      // Create a mapping of header cells to their column info
      const headerMapping = new Map();
      
      tableHeaders.forEach((headerCell, index) => {
        const thText = headerCell.querySelector('.th-text');
        const columnName = thText ? thText.textContent.trim() : headerCell.textContent.trim();
        
        // Find the mapping for this column name
        const columnInfo = nameToFieldMapping[columnName] || {
          field: columnName,
          stateKey: columnName.toLowerCase().replace(/\s+/g, '')
        };
        
        headerMapping.set(headerCell, {
          index,
          name: columnName,
          field: columnInfo.field,
          stateKey: columnInfo.stateKey
        });
        
  (`Mapped header ${index}: "${columnName}" → field: "${columnInfo.field}", stateKey: "${columnInfo.stateKey}"`);
      });
      
      // Get all search buttons (using the specific HTML structure you provided)
      const searchButtons = document.querySelectorAll('.btn-search');
(`Found ${searchButtons.length} search buttons`);
      
      // Setup search buttons
      searchButtons.forEach((button) => {
        const headerCell = button.closest('.table_header');
        if (!headerCell) {
    (`Search button is not inside a table header`);
          return;
        }
        
        // Get column info from our mapping
        const columnInfo = headerMapping.get(headerCell);
        if (!columnInfo) {
    (`Could not find column info for header cell`);
          return;
        }
        
  (`Setting up search button for column: ${columnInfo.name} (${columnInfo.field})`);
        
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Use the existing implementation for search functionality
          const th = headerCell;
          
          // Call the existing activateSearchForHeader function
          if (typeof activateSearchForHeader === 'function') {
            activateSearchForHeader(th);
            } else {
            // Fallback if the function doesn't exist
            // Find the index of this header in the table
            const headerIndex = Array.from(th.parentElement.children).indexOf(th);
            
            // Store in state for our database filtering
            const searchValue = '';
            state.columnSearches[columnInfo.stateKey] = searchValue;
            
            // Call the existing search functionality if it exists
            if (window.activateSearchForHeader) {
              window.activateSearchForHeader(th);
            }
          }
        });
      });
      
      // Setup clear buttons
      const clearButtons = document.querySelectorAll('.btn-clear');
(`Found ${clearButtons.length} clear buttons`);
      
      clearButtons.forEach((button) => {
          const headerCell = button.closest('.table_header');
        if (!headerCell) {
    (`Clear button is not inside a table header`);
          return;
        }
        
        // Get column info from our mapping
        const columnInfo = headerMapping.get(headerCell);
        if (!columnInfo) {
    (`Could not find column info for header cell`);
          return;
        }
        
  (`Setting up clear button for column: ${columnInfo.name}`);
        
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
          // Use the existing implementation for clear functionality
          const th = headerCell;
          
          // Call the existing clearColumnFilter function
          if (typeof clearColumnFilter === 'function') {
            clearColumnFilter(th);
          } else {
            // Fallback if the function doesn't exist
            // Clear this column's filter in state
            state.columnSearches[columnInfo.stateKey] = '';
            applyColumnFilters(state.columnSearches);
            
            // Call the existing clear functionality if it exists
            if (window.clearColumnFilter) {
              window.clearColumnFilter(th);
            }
          }
        });
      });
      
      // Check for existing search inputs and restore their values
      document.querySelectorAll('.th-search, .column-search-input').forEach((input) => {
        const headerCell = input.closest('.table_header');
          if (!headerCell) return;
          
        // Get column info from our mapping
        const columnInfo = headerMapping.get(headerCell);
        if (!columnInfo) return;
        
        if (state.columnSearches[columnInfo.stateKey]) {
          input.value = state.columnSearches[columnInfo.stateKey];
          
          // Show clear button if we have a value
          const btnDiv = headerCell.querySelector('.th-btn-div');
          const clearButton = btnDiv ? btnDiv.querySelector('.btn-clear') : null;
          if (clearButton && input.value) {
            clearButton.style.display = 'block';
          }
        }
      });
    }
    
    function applyColumnFilters(columnSearches) {
      // Build query conditions
      let conditions = [];
      
("Applying column filters:", columnSearches);
      
      // Process all column filters
      const columnMappings = {
        code: 'Code',
        group: 'Group',
        category: 'Category',
        name: 'Activity Name',
        thirdParty: 'Third Party',
        when: 'When',
        notes: 'Notes',
        riskRating: 'Risk Rating',
        dnfbp: 'DNFBP'
      };
      
      // Define which columns are numeric and should use exact matching instead of ilike
      const numericColumns = new Set(['Group']);
      
      // Add conditions for each column with a search term
      Object.entries(columnSearches).forEach(([key, value]) => {
        if (value && value.trim()) {
          const dbField = columnMappings[key];
          if (dbField) {
            // Use quotes for column names with spaces
            const formattedField = dbField.includes(' ') ? `"${dbField}"` : dbField;
            
            // Check if this is a numeric column that should use exact matching
            if (numericColumns.has(dbField)) {
              // For numeric columns, use exact equality
              const searchValue = value.trim();
              conditions.push(`${formattedField}.eq.${searchValue}`);
              
      (`Added exact filter for numeric ${dbField}: ${searchValue} (formatted as: ${formattedField}.eq.${searchValue})`);
            } else {
              // For text columns, use ilike with wildcards
              const filterValue = `%${value.trim()}%`;
              conditions.push(`${formattedField}.ilike.${filterValue}`);
              
      (`Added ilike filter for text ${dbField}: ${value.trim()} (formatted as: ${formattedField}.ilike.${filterValue})`);
            }
            
            // Special debugging for Group column
            if (key === 'group') {
      (`Group column search - key: ${key}, value: "${value.trim()}", dbField: ${dbField}, formattedField: ${formattedField}, isNumeric: ${numericColumns.has(dbField)}`);
            }
          } else {
      (`No database field mapping found for key: ${key}`);
          }
        } else {
      (`Empty or whitespace value for key: ${key}, value: "${value}"`);
        }
      });
      
      // Combine with global search if present
      if (state.searchTerm) {
        const globalSearchValue = state.searchTerm.trim();
        if (globalSearchValue) {
          const globalFilter = `"Activity Name".ilike.%${globalSearchValue}%,Code.ilike.%${globalSearchValue}%,النشاط.ilike.%${globalSearchValue}%`;
          conditions.push(globalFilter);
    (`Added global search filter: ${globalFilter}`);
        }
      }
      
      // Reset to first page
      state.currentPage = 1;
      
      // Apply filters
      if (conditions.length > 0) {
        // Join with commas but ensure there are no empty entries
        state.columnFilters = conditions.filter(Boolean).join(',');
  ("Final column filters:", state.columnFilters);
      } else {
        state.columnFilters = '';
  ("No column filters applied");
      }
      
      // Clear the cache to ensure fresh data
("Clearing cache to ensure fresh data with new filters");
      cache.clear();
      
      // Force a complete reload of data from Supabase
("Forcing reload of data from Supabase with new filters");
      renderPage(1, false);
    }
  
    // ─── Column Visibility Toggle ────────────────────────────────────
    
    function setupColumnToggle() {
("Setting up column toggle...");
      
      // Find column toggle elements directly
      const columnToggleBtn = document.querySelector('.bal-colum-show-btn');
      const columnDropdown = document.querySelector('.bal-colum-dropdown-wrapper');
      const columnItems = document.querySelectorAll('.bal-column-item');
      
("Column toggle elements:", {
        columnToggleBtn,
        columnDropdown,
        columnItems: columnItems.length
      });
      
      if (!columnToggleBtn || !columnDropdown || !columnItems.length) {
        // console.warn("Column toggle elements not found, skipping setup");
        return;
      }
      
      // Toggle dropdown visibility when button is clicked
      columnToggleBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
  ("Column toggle button clicked");
        const isExpanded = columnToggleBtn.getAttribute('aria-expanded') === 'true';
        const newState = !isExpanded;
        
        columnToggleBtn.setAttribute('aria-expanded', String(newState));
        columnDropdown.style.display = newState ? 'block' : 'none';
        
  (`Column dropdown ${newState ? 'shown' : 'hidden'}`);
      });
      
      // Close dropdown when clicking outside
      document.addEventListener('click', (event) => {
        if (columnToggleBtn && columnDropdown && 
            !columnToggleBtn.contains(event.target) && 
            !columnDropdown.contains(event.target)) {
          columnToggleBtn.setAttribute('aria-expanded', 'false');
          columnDropdown.style.display = 'none';
        }
      });
      
      // Create a mapping of column names to their actual positions in the table
      const columnMapping = createColumnMapping();
("Column mapping:", columnMapping);
      
      // Define default active columns
      const defaultActiveColumns = ['Code', 'Group', 'Category', 'Activity Name', 'Third Party'];
      
      // Handle column visibility toggle
      columnItems.forEach((item) => {
        const columnName = item.querySelector('.bal-column-name')?.textContent?.trim();
        const eyeIcon = item.querySelector('.bal-column-eye');
        
        if (!columnName || !eyeIcon) {
    (`Column item missing name or eye icon`);
          return;
        }
        
  (`Setting up column toggle for "${columnName}"`);
        
        // Find the column index from our mapping
        const columnData = columnMapping[columnName];
        if (!columnData) {
          // console.warn(`No mapping found for column "${columnName}"`);
          return;
        }
        
        const { index, headerCell } = columnData;
  (`Column "${columnName}" mapped to index ${index}`);
        
        // Set initial state based on default active columns
        const isDefaultActive = defaultActiveColumns.includes(columnName);
        
        // Set initial class and visibility
        if (isDefaultActive) {
          item.classList.add('is-active');
          toggleColumnVisibility(columnName, index, true);
        } else {
          item.classList.remove('is-active');
          toggleColumnVisibility(columnName, index, false);
        }
        
        // Set up click handler with direct toggle (no double-click needed)
        item.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          
    (`Column item "${columnName}" clicked`);
          
          // Toggle active state immediately
          const isActive = item.classList.contains('is-active');
          
          if (isActive) {
            // Currently active, so hide it
            item.classList.remove('is-active');
            toggleColumnVisibility(columnName, index, false);
      (`Column "${columnName}" hidden`);
          } else {
            // Currently inactive, so show it
            item.classList.add('is-active');
            toggleColumnVisibility(columnName, index, true);
      (`Column "${columnName}" shown`);
          }
        });
      });
    }
    
    // Create a mapping of column names to their positions in the table
    function createColumnMapping() {
      const tableEl = document.querySelector('table.table_component, #bal-table');
      if (!tableEl) {
        // console.error("Table element not found for column mapping");
        return {};
      }
      
      const headerRow = tableEl.querySelector('tr');
      if (!headerRow) {
        // console.error("Header row not found for column mapping");
        return {};
      }
      
      const headerCells = headerRow.querySelectorAll('th');
(`Found ${headerCells.length} header cells for mapping`);
      
      const mapping = {};
      
      // Define expected columns to ensure we don't miss any
      const expectedColumns = [
        'Code', 'Group', 'Category', 'Activity Name', 
        'Third Party', 'When', 'Notes', 'Risk Rating', 'DNFBP'
      ];
      
      // First pass: map columns based on header text
      headerCells.forEach((cell, index) => {
        // Get the column name from the th-text element or the cell's text content
        const thText = cell.querySelector('.th-text');
        let columnName = '';
        
        if (thText) {
          columnName = thText.textContent.trim();
        } else {
          columnName = cell.textContent.trim();
        }
        
        if (columnName) {
          mapping[columnName] = {
            index: index + 1, // 1-based index for CSS nth-child
            headerCell: cell,
            position: index
          };
    (`Mapped "${columnName}" to index ${index + 1}`);
        }
      });
      
      // Second pass: check for missing expected columns and provide fallback mapping
      expectedColumns.forEach((columnName, index) => {
        if (!mapping[columnName]) {
          // console.warn(`Expected column "${columnName}" not found in header. Using fallback position.`);
          
          // Try to find a header cell that might contain this column
          const matchingCell = Array.from(headerCells).find(cell => {
            const cellText = cell.textContent.trim();
            return cellText.includes(columnName);
          });
          
          if (matchingCell) {
            const actualIndex = Array.from(headerCells).indexOf(matchingCell);
            mapping[columnName] = {
              index: actualIndex + 1,
              headerCell: matchingCell,
              position: actualIndex,
              isFallback: true
            };
      (`Fallback mapping: "${columnName}" to index ${actualIndex + 1}`);
          } else {
            // If we still can't find it, use the expected position
            // This is a last resort and might not be accurate
            const fallbackIndex = index;
            if (fallbackIndex < headerCells.length) {
              mapping[columnName] = {
                index: fallbackIndex + 1,
                headerCell: headerCells[fallbackIndex],
                position: fallbackIndex,
                isFallback: true,
                isGuess: true
              };
        (`Guessed mapping: "${columnName}" to index ${fallbackIndex + 1}`);
            }
          }
        }
      });
      
      // Log the final mapping
("Final column mapping:", mapping);
      
      return mapping;
    }
    
    function toggleColumnVisibility(columnName, columnIndex, isVisible) {
      // Get the table element directly
      const tableEl = document.querySelector('table.table_component, #bal-table');
      if (!tableEl) {
        // console.error("Table element not found for column visibility toggle");
        return;
      }
      
(`Toggling column "${columnName}" (index ${columnIndex}) visibility: ${isVisible ? 'show' : 'hide'}`);
      
      // Apply CSS to handle column width automatically
      const styleId = `column-style-${columnIndex}`;
      let styleEl = document.getElementById(styleId);
      
      if (!styleEl && !isVisible) {
        // Create a style element if it doesn't exist and we're hiding a column
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      
      if (styleEl) {
        if (isVisible) {
          // Remove the style element when showing the column
          styleEl.remove();
        } else {
          // Update the style to hide the column
          styleEl.textContent = `
            table.table_component th:nth-child(${columnIndex}),
            #bal-table th:nth-child(${columnIndex}),
            table.table_component td:nth-child(${columnIndex}),
            #bal-table td:nth-child(${columnIndex}) {
              display: none !important;
              width: 0 !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
            }
          `;
        }
      }
      
      // Try multiple approaches to ensure all cells are properly hidden/shown
      
      // Approach 1: Direct nth-child selector
      const headerCells = tableEl.querySelectorAll(`th:nth-child(${columnIndex})`);
      const dataCells = tableEl.querySelectorAll(`td:nth-child(${columnIndex})`);
      
(`Found ${headerCells.length} header cells and ${dataCells.length} data cells for "${columnName}"`);
      
      // If cells found, apply visibility directly
      if (headerCells.length > 0 || dataCells.length > 0) {
        applyVisibility(headerCells, dataCells, isVisible);
        return;
      }
      
      // Approach 2: Find by column name
(`Trying name-based approach for column "${columnName}"`);
      const allHeaderCells = tableEl.querySelectorAll('th');
      const matchingHeaders = Array.from(allHeaderCells).filter(cell => {
        const thText = cell.querySelector('.th-text');
        const cellText = (thText ? thText.textContent : cell.textContent).trim();
        return cellText === columnName || cellText.includes(columnName);
      });
      
      if (matchingHeaders.length > 0) {
  (`Found ${matchingHeaders.length} matching header cells by name`);
        
        // Get the actual index of this header cell
        const actualIndex = Array.from(allHeaderCells).indexOf(matchingHeaders[0]) + 1;
  (`Actual index for "${columnName}" is ${actualIndex}`);
        
        // Use this index to get all cells
        const actualHeaderCells = tableEl.querySelectorAll(`th:nth-child(${actualIndex})`);
        const actualDataCells = tableEl.querySelectorAll(`td:nth-child(${actualIndex})`);
        
  (`Found ${actualHeaderCells.length} header cells and ${actualDataCells.length} data cells using actual index`);
        
        if (actualHeaderCells.length > 0 || actualDataCells.length > 0) {
          // Update the style element to use the actual index
          if (styleEl && !isVisible) {
            styleEl.textContent = `
              table.table_component th:nth-child(${actualIndex}),
              #bal-table th:nth-child(${actualIndex}),
              table.table_component td:nth-child(${actualIndex}),
              #bal-table td:nth-child(${actualIndex}) {
                display: none !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
              }
            `;
          }
          
          applyVisibility(actualHeaderCells, actualDataCells, isVisible);
          return;
        }
      }
      
      // Approach 3: Try using the expected index based on column name
(`Trying expected index approach for "${columnName}"`);
      const expectedColumns = ['Code', 'Group', 'Category', 'Activity Name', 
                              'Third Party', 'When', 'Notes', 'Risk Rating', 'DNFBP'];
      const expectedIndex = expectedColumns.indexOf(columnName) + 1;
      
      if (expectedIndex > 0) {
  (`Using expected index ${expectedIndex} for "${columnName}"`);
        
        const expectedHeaderCells = tableEl.querySelectorAll(`th:nth-child(${expectedIndex})`);
        const expectedDataCells = tableEl.querySelectorAll(`td:nth-child(${expectedIndex})`);
        
  (`Found ${expectedHeaderCells.length} header cells and ${expectedDataCells.length} data cells using expected index`);
        
        if (expectedHeaderCells.length > 0 || expectedDataCells.length > 0) {
          // Update the style element to use the expected index
          if (styleEl && !isVisible) {
            styleEl.textContent = `
              table.table_component th:nth-child(${expectedIndex}),
              #bal-table th:nth-child(${expectedIndex}),
              table.table_component td:nth-child(${expectedIndex}),
              #bal-table td:nth-child(${expectedIndex}) {
                display: none !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
              }
            `;
          }
          
          applyVisibility(expectedHeaderCells, expectedDataCells, isVisible);
          return;
        }
      }
      
      // Approach 4: Last resort - try all columns by index
(`Trying all columns approach for "${columnName}"`);
      for (let i = 1; i <= allHeaderCells.length; i++) {
        const testHeaderCells = tableEl.querySelectorAll(`th:nth-child(${i})`);
        const testDataCells = tableEl.querySelectorAll(`td:nth-child(${i})`);
        
        const headerText = testHeaderCells.length > 0 ? 
          (testHeaderCells[0].querySelector('.th-text')?.textContent || testHeaderCells[0].textContent).trim() : '';
        
        if (headerText === columnName || headerText.includes(columnName)) {
    (`Found matching column at index ${i} with header text "${headerText}"`);
          
          // Update the style element to use this index
          if (styleEl && !isVisible) {
            styleEl.textContent = `
              table.table_component th:nth-child(${i}),
              #bal-table th:nth-child(${i}),
              table.table_component td:nth-child(${i}),
              #bal-table td:nth-child(${i}) {
                display: none !important;
                width: 0 !important;
                padding: 0 !important;
                margin: 0 !important;
                border: none !important;
              }
            `;
          }
          
          applyVisibility(testHeaderCells, testDataCells, isVisible);
          return;
        }
      }
      
      // console.warn(`Could not find column "${columnName}" using any approach`);
    }
    
    // Helper function to apply visibility to cells
    function applyVisibility(headerCells, dataCells, isVisible) {
      const displayValue = isVisible ? '' : 'none';
      const widthValue = isVisible ? '' : '0';
      
      headerCells.forEach(cell => {
        cell.style.display = displayValue;
        if (!isVisible) {
          cell.style.width = widthValue;
          cell.style.padding = '0';
          cell.style.margin = '0';
          cell.style.border = 'none';
        } else {
          cell.style.width = '';
          cell.style.padding = '';
          cell.style.margin = '';
          cell.style.border = '';
        }
      });
      
      dataCells.forEach(cell => {
        cell.style.display = displayValue;
        if (!isVisible) {
          cell.style.width = widthValue;
          cell.style.padding = '0';
          cell.style.margin = '0';
          cell.style.border = 'none';
        } else {
          cell.style.width = '';
          cell.style.padding = '';
          cell.style.margin = '';
          cell.style.border = '';
        }
      });
    }
    
    // ─── Saved Items Management ────────────────────────────────────
    
    // Check if an item is saved
    function isItemSaved(code) {
      const savedActivities = getSavedActivities();
      return savedActivities.some(act => act.Code === code);
    }
    
    // Get saved activities from localStorage
    function getSavedActivities() {
      try {
        return JSON.parse(localStorage.getItem('savedActivities') || '[]');
      } catch (error) {
        // console.error('Error parsing saved activities:', error);
        return [];
      }
    }
    
    // Save activities to localStorage
    function saveSavedActivities(activities) {
      try {
        localStorage.setItem('savedActivities', JSON.stringify(activities));
        // Update state
        state.savedItems = activities;
        // Update saved items count if element exists
        updateSavedItemsCount(activities.length);
      } catch (error) {
        // console.error('Error saving activities:', error);
      }
    }
    
    // Update the saved items count display
    function updateSavedItemsCount(count) {
      // Format the count to always have 2 digits (e.g., 01, 02, etc.)
      const formattedCount = count.toString().padStart(2, '0');
      
      // Update all saved count elements
      if (dom.savedItemsCount && dom.savedItemsCount.length > 0) {
        dom.savedItemsCount.forEach(countEl => {
          countEl.textContent = formattedCount;
        });
      }
      
      // Also find any other saved count elements that might not be in the dom object
      document.querySelectorAll('.saved-count').forEach(countEl => {
        countEl.textContent = formattedCount;
      });
    }
    
    // Expose updateSavedItemsCount to window for direct access from event handlers
    window.updateSavedItemsCount = updateSavedItemsCount;
    
    // Toggle saved state for an item
    function toggleSavedItem(item, saveButton, row) {
      const isSaved = saveButton?.classList.contains('saved');
      const savedActivities = getSavedActivities();
      
      if (isSaved) {
        // Remove saved state
        if (saveButton) {
          saveButton.classList.remove('saved');
          const svgPath = saveButton.querySelector('svg path');
          if (svgPath) svgPath.setAttribute('stroke', '#6B7094');
        }
        if (row) row.classList.remove('is-saved');
        
        // Remove from saved items
        const updatedSaved = savedActivities.filter(act => act.Code !== item.Code);
        saveSavedActivities(updatedSaved);
        
        // Update saved items table
        renderSavedItems();
      } else {
        // Add saved state
        if (saveButton) {
          saveButton.classList.add('saved');
          const svgPath = saveButton.querySelector('svg path');
          if (svgPath) svgPath.setAttribute('stroke', '#06603A');
        }
        if (row) row.classList.add('is-saved');
        
        // Add to saved items if not already there
        if (!savedActivities.some(act => act.Code === item.Code)) {
          savedActivities.push({
            Code: item.Code,
            Group: item.Group,
            Category: item.Category,
            'Activity Name': item['Activity Name'],
            'Third Party': item['Third Party'] || 'N/A'
          });
          saveSavedActivities(savedActivities);
          
          // Update saved items table
          renderSavedItems();
        }
      }
    }
    
    // Render saved items in the saved items table
    function renderSavedItems() {
("Rendering saved items...");
      
      // Re-query the DOM in case it wasn't available during initialization
      if (!dom.savedTableBody) {
  ("Saved table body not found in DOM object, trying to re-query...");
        dom.savedTableBody = document.querySelector('.bal-table-saved-tbody, #saved_list_table tbody, .bal-table-saved tbody');
  ("Re-query result:", !!dom.savedTableBody);
      }
      
      if (!dom.savedTableBody) {
        // console.error("Cannot find saved table body element");
        return;
      }
      
      const savedActivities = getSavedActivities();
(`Found ${savedActivities.length} saved activities to render`);
      
      // Clear the table
("Clearing saved table body...");
      dom.savedTableBody.innerHTML = '';
      
      if (savedActivities.length === 0) {
        // Show empty state
        const emptyRow = document.createElement('tr');
        emptyRow.className = 'bal-table-saved-trow';
        
        const emptyCell = document.createElement('td');
        emptyCell.className = 'bal-table-saved-td';
        emptyCell.colSpan = 4; // Updated to 4 columns
        emptyCell.textContent = 'No saved activities';
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '20px';
        
        emptyRow.appendChild(emptyCell);
        dom.savedTableBody.appendChild(emptyRow);
      } else {
        // Add each saved activity to the table
        savedActivities.forEach(item => {
          const row = document.createElement('tr');
          row.className = 'bal-table-saved-trow';
          
          // Group column
          const groupCell = document.createElement('td');
          groupCell.className = 'bal-table-saved-td';
          groupCell.textContent = item.Group || '';
          row.appendChild(groupCell);
          
          // Category column
          const categoryCell = document.createElement('td');
          categoryCell.className = 'bal-table-saved-td';
          categoryCell.textContent = item.Category || '';
          row.appendChild(categoryCell);
          
          // Activity Name column with icons
          const nameCell = document.createElement('td');
          nameCell.className = 'bal-table-saved-td';
          
          const nameDiv = document.createElement('div');
          nameDiv.className = 'bal-table-td-div';
          
          const nameText = document.createElement('p');
          nameText.className = 'td-text';
          nameText.textContent = item['Activity Name'] || '';
          nameDiv.appendChild(nameText);
          
          // Add icons container
          const iconsDiv = document.createElement('div');
          iconsDiv.className = 'bal-name-td-icons';
          
          // Copy button
          const copyBtnDiv = document.createElement('div');
          copyBtnDiv.className = 'code-embed-150 w-embed';
          const copyButton = document.createElement('button');
          copyButton.type = 'submit';
          copyButton.className = 'btn-copy';
          copyButton.setAttribute('aria-label', 'Copy');
          copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="13" viewBox="0 0 10 13" fill="none">
  <path d="M5.5 10.5C6.1628 10.4992 6.79822 10.2356 7.26689 9.7669C7.73556 9.29823 7.99921 8.66281 8 8.00001V3.62151C8.00078 3.35869 7.94938 3.09833 7.84879 2.85552C7.7482 2.61271 7.60041 2.39228 7.414 2.20701L6.293 1.08601C6.10773 0.899596 5.8873 0.75181 5.64449 0.651219C5.40168 0.550627 5.14132 0.499231 4.8785 0.500009H2.5C1.8372 0.500803 1.20178 0.76445 0.73311 1.23312C0.264441 1.70179 0.000793929 2.33721 0 3.00001V8.00001C0.000793929 8.66281 0.264441 9.29823 0.73311 9.7669C1.20178 10.2356 1.8372 10.4992 2.5 10.5H5.5ZM1 8.00001V3.00001C1 2.60218 1.15804 2.22065 1.43934 1.93935C1.72064 1.65804 2.10218 1.50001 2.5 1.50001C2.5 1.50001 4.9595 1.50701 5 1.51201V2.50001C5 2.76523 5.10536 3.01958 5.29289 3.20712C5.48043 3.39465 5.73478 3.50001 6 3.50001H6.988C6.993 3.54051 7 8.00001 7 8.00001C7 8.39783 6.84196 8.77936 6.56066 9.06067C6.27936 9.34197 5.89782 9.50001 5.5 9.50001H2.5C2.10218 9.50001 1.72064 9.34197 1.43934 9.06067C1.15804 8.77936 1 8.39783 1 8.00001ZM10 4.50001V10C9.99921 10.6628 9.73556 11.2982 9.26689 11.7669C8.79822 12.2356 8.1628 12.4992 7.5 12.5H3C2.86739 12.5 2.74021 12.4473 2.64645 12.3536C2.55268 12.2598 2.5 12.1326 2.5 12C2.5 11.8674 2.55268 11.7402 2.64645 11.6465C2.74021 11.5527 2.86739 11.5 3 11.5H7.5C7.89782 11.5 8.27936 11.342 8.56066 11.0607C8.84196 10.7794 9 10.3978 9 10V4.50001C9 4.3674 9.05268 4.24022 9.14645 4.14646C9.24021 4.05269 9.36739 4.00001 9.5 4.00001C9.63261 4.00001 9.75979 4.05269 9.85355 4.14646C9.94732 4.24022 10 4.3674 10 4.50001Z" fill="black" fill-opacity="0.6"/>
</svg>`;
          
          // Add click event to copy activity name
          copyButton.addEventListener('click', (event) => {
            event.stopPropagation();
            const textToCopy = item['Activity Name'] || '';
            navigator.clipboard.writeText(textToCopy)
              .then(() => {
                // Show feedback
                const originalColor = copyButton.style.color;
                copyButton.style.color = '#056633';
                setTimeout(() => {
                  copyButton.style.color = originalColor;
                }, 1000);
              })
              .catch(err => {
                // console.error('Failed to copy text:', err);
              });
          });
          
          copyBtnDiv.appendChild(copyButton);
          
          // Remove button (using save button style)
          const removeBtnDiv = document.createElement('div');
          removeBtnDiv.className = 'code-embed-150 w-embed';
          const removeButton = document.createElement('button');
          removeButton.type = 'submit';
          removeButton.className = 'btn-save saved';
          removeButton.setAttribute('aria-label', 'Remove');
          removeButton.innerHTML = `<svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M10 12L5.5 9L1 12V1C1 0.734784 1.10536 0.48043 1.29289 0.292893C1.48043 0.105357 1.73478 0 2 0H9C9.26522 0 9.51957 0.105357 9.70711 0.292893C9.89464 0.48043 10 0.734784 10 1V12Z" stroke="#056633" fill="#056633" fill-opacity="1" stroke-linecap="round" stroke-linejoin="round"></path>
            </svg>`;
          
          // Add click event to remove item
          removeButton.addEventListener('click', (event) => {
            event.stopPropagation();
            
            // Remove from saved items
            const savedActivities = getSavedActivities();
            const updatedSaved = savedActivities.filter(act => act.Code !== item.Code);
            saveSavedActivities(updatedSaved);
            
            // Update saved items table
            renderSavedItems();
            
            // Update main table if the item is visible there
            const mainTableRow = document.querySelector(`.table_row[data-activity-code="${item.Code}"]`);
            if (mainTableRow) {
              mainTableRow.classList.remove('is-saved');
              const saveBtn = mainTableRow.querySelector('.btn-save');
              if (saveBtn) {
                saveBtn.classList.remove('saved');
                const svgPath = saveBtn.querySelector('svg path');
                if (svgPath) svgPath.setAttribute('stroke', '#6B7094');
              }
            }
          });
          
          removeBtnDiv.appendChild(removeButton);
          
          iconsDiv.appendChild(copyBtnDiv);
          iconsDiv.appendChild(removeBtnDiv);
          nameDiv.appendChild(iconsDiv);
          nameCell.appendChild(nameDiv);
          row.appendChild(nameCell);
          
          // Code column
          const codeCell = document.createElement('td');
          codeCell.className = 'bal-table-saved-td';
          codeCell.textContent = item.Code || '';
          row.appendChild(codeCell);
          
          // Store activity code for reference
          row.dataset.activityCode = item.Code;
          
          dom.savedTableBody.appendChild(row);
        });
      }
      
      // Update saved items count
      updateSavedItemsCount(savedActivities.length);
    }
    
    // ─── Third Party Approval Filter ─────────────────────────────
    
    // Fetch unique third parties from the API
    async function fetchThirdParties() {
("Fetching unique third parties...");
      
      try {
        // Query Supabase for unique third parties
        // Use correct column name syntax with quotes for columns with spaces
        const { data, error } = await supabase
          .from('Activity List')
          .select('"Third Party"')
          .not('"Third Party"', 'is', null);
        
        if (error) {
          // console.error("Error fetching third parties:", error);
          return [];
        }
        
        // Extract unique third parties and sort them
        const thirdParties = Array.from(new Set(data.map(item => item['Third Party']))).filter(Boolean).sort();
        
        // Debug the data structure
  ("First few data items:", data.slice(0, 3));
  (`Found ${thirdParties.length} unique third parties:`, thirdParties);
        
        return thirdParties;
      } catch (error) {
        // console.error("Error in fetchThirdParties:", error);
        return [];
      }
    }
    
    // Populate third party checkboxes in the dropdown
    function populateThirdPartyCheckboxes(thirdParties) {
("Populating third party checkboxes...");
      
      // Debug: Log all forms on the page
("All forms on the page:");
      document.querySelectorAll('form').forEach((form, index) => {
  (`Form ${index}:`, form.id, form.className);
      });
      
      // Debug: Try multiple selectors to find the container
("Trying to find checkbox container with different selectors:");
      
      const selectors = [
        '.bal-dropdown-checkbox-wrap',
        '.bal-select-items-wrap form',
        '#email-form',
        '.w-dropdown-list .w-form form',
        'form.bal-select-items-wrap'
      ];
      
      let checkboxContainer = null;
      
      selectors.forEach(selector => {
        const element = document.querySelector(selector);
  (`Selector "${selector}":`, !!element);
        if (element && !checkboxContainer) {
          checkboxContainer = element;
        }
      });
      
      // If we found a form but not the specific container, look for the container inside the form
      if (checkboxContainer && !checkboxContainer.classList.contains('bal-dropdown-checkbox-wrap')) {
        const innerContainer = checkboxContainer.querySelector('.bal-dropdown-checkbox-wrap');
        if (innerContainer) {
    ("Found inner container inside form");
          checkboxContainer = innerContainer;
        } else {
          // Try to find the exact form from the HTML you provided
          const exactForm = document.querySelector('form#email-form.bal-select-items-wrap');
          if (exactForm) {
      ("Found exact form from HTML");
            // Look for existing container or create one
            const existingContainer = exactForm.querySelector('.bal-dropdown-checkbox-wrap');
            if (existingContainer) {
              checkboxContainer = existingContainer;
            } else {
        ("Creating new checkbox container inside exact form");
              const newContainer = document.createElement('div');
              newContainer.className = 'bal-dropdown-checkbox-wrap';
              exactForm.appendChild(newContainer);
              checkboxContainer = newContainer;
            }
          } else {
            // If no specific container found, we'll create one in the form we found
      ("Creating new checkbox container inside form");
            const newContainer = document.createElement('div');
            newContainer.className = 'bal-dropdown-checkbox-wrap';
            checkboxContainer.appendChild(newContainer);
            checkboxContainer = newContainer;
          }
        }
      }
      
      if (!checkboxContainer) {
        // console.warn("Third party checkbox container not found with any selector");
        
        // As a last resort, find the dropdown and create the structure
        const dropdown = document.querySelector('.bal-select-items-wrap');
        if (dropdown) {
    ("Found dropdown, creating container structure");
          checkboxContainer = document.createElement('div');
          checkboxContainer.className = 'bal-dropdown-checkbox-wrap';
          dropdown.appendChild(checkboxContainer);
        } else {
          // console.error("Could not find any suitable container for checkboxes");
          return;
        }
      }
      
      // Clear existing checkboxes
      checkboxContainer.innerHTML = '';
      
      // Add each third party as a checkbox
      thirdParties.forEach((thirdParty, index) => {
        const checkboxDiv = document.createElement('div');
        checkboxDiv.className = 'bal-dropdown-link';
        
        const label = document.createElement('label');
        label.className = 'w-checkbox bal-checkbox-field';
        
        const checkboxInput = document.createElement('div');
        checkboxInput.className = 'w-checkbox-input w-checkbox-input--inputType-custom bal-checkbox';
        
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.name = `Checkbox-ThirdParty-${index}`;
        input.id = `Checkbox-ThirdParty-${index}`;
        input.dataset.name = `Checkbox-ThirdParty-${index}`;
        input.style.opacity = '0';
        input.style.position = 'absolute';
        input.style.zIndex = '-1';
        
        const span = document.createElement('span');
        span.className = 'bal-checkbox-label w-form-label';
        span.setAttribute('for', `Checkbox-ThirdParty-${index}`);
        span.textContent = thirdParty;
        
        label.appendChild(checkboxInput);
        label.appendChild(input);
        label.appendChild(span);
        checkboxDiv.appendChild(label);
        checkboxContainer.appendChild(checkboxDiv);
      });
      
(`Added ${thirdParties.length} third party checkboxes`);
      
      // Update DOM reference to include new checkboxes
      dom.thirdPartyCheckboxes = document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]');
    }
    
    // Set up third party approval toggle and checkboxes
    async function setupThirdPartyFilter() {
("Setting up third party approval filter...");
      
      // Check if the toggle exists
      if (!dom.thirdPartyToggle) {
        // console.warn("Third party toggle not found");
        return;
      }
      
("Third party toggle found");
      
      // Fetch third parties from API and populate checkboxes
      try {
        const thirdParties = await fetchThirdParties();
        if (thirdParties.length > 0) {
          populateThirdPartyCheckboxes(thirdParties);
        } else {
          // console.warn("No third parties found in the database");
        }
      } catch (error) {
        // console.error("Error setting up third party filter:", error);
      }
      
      // Set up the main toggle
      dom.thirdPartyToggle.addEventListener('change', (event) => {
        state.thirdPartyApproval = event.target.checked;
  (`Third party approval filter: ${state.thirdPartyApproval ? 'ON' : 'OFF'}`);
        
        // Reset to first page and reload data
        state.currentPage = 1;
        cache.clear(); // Clear cache when changing filters
        renderPage(1);
      });
      
      // Set up event delegation for checkbox changes - use document level delegation
      // to catch events regardless of where the checkboxes are in the DOM
      document.addEventListener('change', (event) => {
        // Check if the changed element is a checkbox in our dropdown
        if (event.target.type === 'checkbox' && 
            (event.target.closest('.bal-dropdown-checkbox-wrap') || 
             event.target.closest('.bal-select-items-wrap'))) {
          
          const thirdPartyName = event.target.nextElementSibling?.textContent?.trim();
          if (!thirdPartyName) return;
          
    (`Checkbox changed: ${thirdPartyName} - ${event.target.checked ? 'checked' : 'unchecked'}`);
          
          if (event.target.checked) {
            // Add to selected third parties if not already there
            if (!state.selectedThirdParties.includes(thirdPartyName)) {
              state.selectedThirdParties.push(thirdPartyName);
            }
          } else {
            // Remove from selected third parties
            state.selectedThirdParties = state.selectedThirdParties.filter(tp => tp !== thirdPartyName);
          }
          
    ("Selected third parties:", state.selectedThirdParties);
          
          // Reset to first page and reload data
          state.currentPage = 1;
          cache.clear(); // Clear cache when changing filters
          renderPage(1);
        }
      });
      
      // Set up unselect all button
      if (dom.unselectAllBtn) {
        dom.unselectAllBtn.addEventListener('click', (event) => {
          event.preventDefault();
          
          // Get current checkboxes (they might have been dynamically created)
          const checkboxes = document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]');
          
          // Uncheck all checkboxes
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          
          // Clear selected third parties
          state.selectedThirdParties = [];
    ("Cleared all selected third parties");
          
          // Reset to first page and reload data
          state.currentPage = 1;
          cache.clear(); // Clear cache when changing filters
          renderPage(1);
        });
      }
      
      // Set up reset button
      if (dom.resetBtn) {
        dom.resetBtn.addEventListener('click', (event) => {
          event.preventDefault();
          
          // Reset third party approval toggle
          dom.thirdPartyToggle.checked = false;
          state.thirdPartyApproval = false;
          
          // Get current checkboxes (they might have been dynamically created)
          const checkboxes = document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]');
          
          // Uncheck all checkboxes
          checkboxes.forEach(checkbox => {
            checkbox.checked = false;
          });
          
          // Clear selected third parties
          state.selectedThirdParties = [];
    ("Reset third party filter");
          
          // Reset to first page and reload data
          state.currentPage = 1;
          cache.clear(); // Clear cache when changing filters
          renderPage(1);
        });
      }
    }
    
    // ─── Initialization ────────────────────────────────────────────
  
    async function initialize() {
      try {
  ("Initializing business activity table...");
        
        // Debug DOM elements
  ("DOM elements check:");
  ("tableEl:", dom.tableEl);
  ("tableBodyEl:", dom.tableBodyEl);
  ("categoryContainers:", dom.categoryContainers);
  ("searchEl:", dom.searchEl);
  ("columnToggleBtn:", dom.columnToggleBtn);
  ("columnDropdown:", dom.columnDropdown);
        
        // Dynamically import Supabase client
  ("Importing Supabase client...");
        const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
        supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  ("Supabase client created");
  
        // Validate only essential DOM elements
        if (!dom.tableEl || !dom.tableBodyEl) {
          // console.error('Required DOM elements not found. Please check HTML structure for missing elements.');
          
          // Detailed error messages for each missing element
          if (!dom.tableEl) // console.error('Missing table element with class "table_component" or ID "bal-table"');
          if (!dom.tableBodyEl) // console.error('Missing table body element with selector "table.table_component tbody.table_body" or "#bal-table .table_body"');
          
          return;
        }
  
        // Set up search if available
        if (dom.searchEl) {
    ("Setting up search functionality...");
        setupSearch();
        }
        
        // Set up column toggle if available
        if (dom.columnToggleBtn && dom.columnDropdown) {
    ("Setting up column toggle...");
        setupColumnToggle();
        }
        
        // Set up category and group filters
  ("Initializing category and group filters...");
        await initCategoryRadios();
        
        // Always default to 'All Categories' on page load
        state.currentCategory = '';
        state.currentGroup = '';
        
        // Update active classes
        updateActiveCategoryClass();
        
        // Set up infinite scroll
  ("Setting up infinite scroll...");
        setupInfiniteScroll();
        
        // Set up third party approval filter
  ("Setting up third party approval filter...");
        setupThirdPartyFilter();
        
        // Load saved items
  ("Loading saved items...");
  ("Saved table found:", !!dom.savedTable);
  ("Saved table body found:", !!dom.savedTableBody);
        if (dom.savedTableBody) {
    ("Saved table body selector matched:", dom.savedTableBody.className);
        }
        const savedActivities = getSavedActivities();
        state.savedItems = savedActivities;
  ("Saved activities count:", savedActivities.length);
        renderSavedItems();
        
        // Ensure search form is properly initialized
  ("Re-initializing search form...");
        // Re-query DOM elements for search
        dom.searchForm = document.querySelector('#wf-form-searchInput, form[name="wf-form-searchInput"]');
        dom.searchEl = document.querySelector('#search-input, .bal-search-input, input[type="search"], #global-search, .search-input');
        dom.searchSubmitBtn = document.querySelector('.bal-search-submit, .bal-search svg, .bal-search-submit svg');
        
        // Log search elements
  ("Search form found:", !!dom.searchForm);
  ("Search input found:", !!dom.searchEl);
  ("Search button found:", !!dom.searchSubmitBtn);
        
        // Re-initialize search functionality
        setupSearch();
        
        // Set up clear all saved items button
        const clearAllBtn = document.querySelector('.clear-save-btn');
        if (clearAllBtn) {
  ("Clear all button found, setting up event listener");
          clearAllBtn.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            
            // Clear all saved items
            saveSavedActivities([]);
            
            // Update the saved items table
            renderSavedItems();
            
            // Update all main table rows to remove saved state
            document.querySelectorAll('.table_row.is-saved').forEach(row => {
              row.classList.remove('is-saved');
              const saveBtn = row.querySelector('.btn-save');
              if (saveBtn) {
                saveBtn.classList.remove('saved');
                const svgPath = saveBtn.querySelector('svg path');
                if (svgPath) svgPath.setAttribute('stroke', '#6B7094');
              }
            });
            
  ("All saved items cleared");
          });
        } else {
  ("Clear all button not found");
        }
        
        // Load initial data
  ("Loading initial data...");
        state.currentPage = 1;
        await renderPage(1);
  ("Initialization complete");
        
      } catch (error) {
        // console.error('Initialization error:', error);
        // console.error(error.stack); // Show full stack trace
      }
    }
    
    // Set up infinite scroll functionality
    function setupInfiniteScroll() {
("Setting up infinite scroll handler");
      
      // Use a debounce function to prevent multiple calls
      let scrollTimeout;
      let isLoading = false;
      
      window.addEventListener('scroll', () => {
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
          // Check if we're near the bottom of the page
          const scrollPosition = window.scrollY + window.innerHeight;
          const documentHeight = document.documentElement.scrollHeight;
          
          // Load more when user scrolls to 80% of the page
          if (scrollPosition > documentHeight * 0.8 && !isLoading) {
      ("Scroll threshold reached, loading more data");
            isLoading = true;
            
            // Load next page
            const nextPage = state.currentPage + 1;
            renderPage(nextPage, true).finally(() => {
              isLoading = false;
            });
          }
        }, 100);
      });
    }
  
    // ─── Start on DOM ready ────────────────────────────────────────
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize);
    } else {
      initialize();
    }
  
  })();
  
//For - third-party-select
(function () {
  // Helper to fire a change event so any UI library (e.g., Webflow) updates visuals
  function triggerChange(el) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // For each widget container
  document.querySelectorAll('.third-party-approval').forEach(function (wrap) {
    const master = wrap.querySelector('.bal-third-party-select .toggle input[type="checkbox"]');
    if (!master) return;

    const getItemCheckboxes = () =>
      wrap.querySelectorAll('.bal-select-options input[type="checkbox"]');

    // Apply state to all item checkboxes
    function setAllItems(checked) {
      getItemCheckboxes().forEach(function (cb) {
        if (cb.checked !== checked) {
          cb.checked = checked;
          triggerChange(cb);
        }
      });
      updateMasterState();
    }

    // Keep master checkbox state (checked/indeterminate) in sync with items
    function updateMasterState() {
      const items = Array.from(getItemCheckboxes());
      const total = items.length;
      const checkedCount = items.filter(cb => cb.checked).length;

      if (checkedCount === 0) {
        master.indeterminate = false;
        master.checked = false;
      } else if (checkedCount === total) {
        master.indeterminate = false;
        master.checked = true;
      } else {
        master.indeterminate = true;
      }
    }

    // 1) Master toggle → (un)check all items
    master.addEventListener('change', function () {
      setAllItems(master.checked);
    });

    // 2) "Unselect All" → uncheck master and all items (supports both class variants)
    wrap.querySelectorAll(
      '.bal-select-head .unselect-all, .bal-third-party-select-header .unselect-all'
    ).forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (master.checked || master.indeterminate) {
          master.indeterminate = false;
          master.checked = false;
          triggerChange(master);
        }
        setAllItems(false);
      });
    });

    // Also keep master updated when user clicks individual items
    wrap.addEventListener('change', function (e) {
      if (e.target.matches('.bal-select-options input[type="checkbox"]')) {
        updateMasterState();
      }
    });

    // 🔹 Robust: prevent dropdown toggling when clicking inside `.toggle`
    const dropdownToggle = wrap.querySelector('.w-dropdown-toggle');
    if (dropdownToggle) {
      const blockIfInsideToggle = function (e) {
        if (e.target && e.target.closest('.toggle')) {
          // Block Webflow's dropdown handlers, but DO NOT preventDefault,
          // so the checkbox still toggles.
          e.stopPropagation();
          e.stopImmediatePropagation();
        }
      };
      // Capture-phase listeners for all the usual suspects
      ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend']
        .forEach(function (type) {
          dropdownToggle.addEventListener(type, blockIfInsideToggle, true);
        });
    }

    // Initialize state on load
    updateMasterState();
  });
})();



//For - Table filter search
document.addEventListener("DOMContentLoaded", function () {
  const table = document.querySelector("#bal-table.table_component");
  if (!table) return;

  const thead = table.querySelector("thead.table_head");
  const tbody = table.querySelector("tbody.table_body");
  const headerCells = Array.from(thead.querySelectorAll(".table_header"));
  const colCount = headerCells.length;

  const activeFilters = new Map();

  // Initially hide all clear buttons
  thead.querySelectorAll(".btn-clear").forEach(btn => btn.style.display = "none");

  function getCellText(row, colIndex) {
    const cell = row.children[colIndex];
    return (cell?.textContent || "").trim().toLowerCase();
  }

  function removeNoResults() {
    const old = tbody.querySelector("tr.no-results");
    if (old) old.remove();
  }

  function showNoResults() {
    removeNoResults();
    const tr = document.createElement("tr");
    tr.className = "no-results";
    const td = document.createElement("td");
    td.colSpan = colCount;
    td.style.textAlign = "center";
    td.textContent = "no filter items listed";
    tr.appendChild(td);
    tbody.appendChild(tr);
  }

  function applyFilters() {
    removeNoResults();
    const rows = Array.from(tbody.querySelectorAll("tr.table_row"));
    let visible = 0;

    rows.forEach((row) => {
      let show = true;
      for (const [colIndex, term] of activeFilters.entries()) {
        const text = getCellText(row, colIndex);
        if (!text.includes(term)) {
          show = false;
          break;
        }
      }
      row.style.display = show ? "" : "none";
      if (show) visible++;
    });

    if (visible === 0) showNoResults();
  }

  function activateSearchForHeader(th) {
    const colIndex = headerCells.indexOf(th);
    if (colIndex < 0) return;

    const container = th.querySelector(".bal-table-td-div") || th;
    const label = container.querySelector(".th-text");
    const searchBtn = th.querySelector(".btn-search");
    const clearBtn = th.querySelector(".btn-clear");

    // Hide search, show clear
    searchBtn.style.display = "none";
    clearBtn.style.display = "inline-block";

    let input = container.querySelector("input.th-search");
    if (input) {
      input.focus();
      input.select();
      return;
    }

    input = document.createElement("input");
    input.className = "th-search";
    input.type = "text";
    input.placeholder = "Type…";
    input.autocomplete = "off";
    input.style.width = "100%";
    input.style.boxSizing = "border-box";

    if (label) label.style.display = "none";
    label?.parentNode.insertBefore(input, label.nextSibling);

    input.addEventListener("input", function () {
      const val = input.value.trim().toLowerCase();
      const originalVal = input.value.trim(); // Keep original case for database search
      if (val) {
        activeFilters.set(colIndex, val);
        searchBtn.style.display = "none";
        clearBtn.style.display = "inline-block";
      } else {
        activeFilters.delete(colIndex);
        searchBtn.style.display = "inline-block";
        clearBtn.style.display = "none";
      }
      
      // Apply local filters
      applyFilters();
      
      // Update our state for database filtering if available
      if (window.state && window.state.columnSearches) {
        // Get the column name from the header
        const thText = th.querySelector('.th-text');
        const columnName = thText ? thText.textContent.trim() : '';
        
        // Find the appropriate state key
        let stateKey = '';
        if (columnName === 'Code') stateKey = 'code';
        else if (columnName === 'Group') stateKey = 'group';
        else if (columnName === 'Category') stateKey = 'category';
        else if (columnName === 'Activity Name') stateKey = 'name';
        else if (columnName === 'Third Party') stateKey = 'thirdParty';
        else if (columnName === 'When') stateKey = 'when';
        else if (columnName === 'Notes') stateKey = 'notes';
        else if (columnName === 'Risk Rating') stateKey = 'riskRating';
        else if (columnName === 'DNFBP') stateKey = 'dnfbp';
        
        // Update state and apply filters if we found a matching key
        if (stateKey && window.applyColumnFilters) {
          // Use original case for database search, not lowercase
          window.state.columnSearches[stateKey] = originalVal;
          
          // Debug logging for Group column
          if (stateKey === 'group') {
      (`Group column search activated - columnName: "${columnName}", stateKey: ${stateKey}, value: "${originalVal}"`);
          }
          
          window.applyColumnFilters(window.state.columnSearches);
        } else {
          // Debug logging for unmapped columns
          if (columnName === 'Group') {
      (`Group column not mapped - columnName: "${columnName}", stateKey: ${stateKey}`);
          }
        }
      }
    });

    input.addEventListener("keydown", function (e) {
      if (e.key === "Escape") {
        input.value = "";
        activeFilters.delete(colIndex);
        clearColumnFilter(th);
        applyFilters();
        e.preventDefault();
      }
    });
    
    // Add blur event to auto-close when unfocused
    input.addEventListener("blur", function(e) {
      // Don't close if clicking on search or clear buttons
      const relatedTarget = e.relatedTarget;
      if (relatedTarget && 
          (relatedTarget.classList.contains('btn-search') || 
           relatedTarget.classList.contains('btn-clear') ||
           relatedTarget.closest('.btn-search') || 
           relatedTarget.closest('.btn-clear'))) {
        return;
      }
      
      // If there's a value, preserve the filter and keep the input visible
      if (input.value.trim()) {
        activeFilters.set(colIndex, input.value.trim());
        applyFilters();
        // Keep the input visible so user can see and edit the filter
      } else {
        // If no value, clear the filter completely
        clearColumnFilter(th);
      }
    });

    input.focus();
  }

  function hideSearchInput(th) {
    const container = th.querySelector(".bal-table-td-div") || th;
    const input = container.querySelector("input.th-search");
    const label = container.querySelector(".th-text");
    const searchBtn = th.querySelector(".btn-search");
    const clearBtn = th.querySelector(".btn-clear");

    if (input) input.remove();
    if (label) label.style.display = "";
    searchBtn.style.display = "inline-block";
    clearBtn.style.display = "none";
  }

  function clearColumnFilter(th) {
    const colIndex = headerCells.indexOf(th);
    if (colIndex < 0) return;

    activeFilters.delete(colIndex);

    hideSearchInput(th);

    // Apply local filters
    applyFilters();
    
    // Update our state for database filtering if available
    if (window.state && window.state.columnSearches) {
      // Get the column name from the header
      const thText = th.querySelector('.th-text');
      const columnName = thText ? thText.textContent.trim() : '';
      
      // Find the appropriate state key
      let stateKey = '';
      if (columnName === 'Code') stateKey = 'code';
      else if (columnName === 'Group') stateKey = 'group';
      else if (columnName === 'Category') stateKey = 'category';
      else if (columnName === 'Activity Name') stateKey = 'name';
      else if (columnName === 'Third Party') stateKey = 'thirdParty';
      else if (columnName === 'When') stateKey = 'when';
      else if (columnName === 'Notes') stateKey = 'notes';
      else if (columnName === 'Risk Rating') stateKey = 'riskRating';
      else if (columnName === 'DNFBP') stateKey = 'dnfbp';
      // Update state and apply filters if we found a matching key
      if (stateKey && window.applyColumnFilters) {
        window.state.columnSearches[stateKey] = '';
        window.applyColumnFilters(window.state.columnSearches);
      }
    }
  }

  // Bind search buttons
  thead.querySelectorAll(".table_header .btn-search").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const th = btn.closest(".table_header");
      if (!th) return;
      activateSearchForHeader(th);
    });
  });

  // Bind clear buttons
  thead.querySelectorAll(".table_header .btn-clear").forEach((btn) => {
    btn.addEventListener("click", function (e) {
      e.preventDefault();
      const th = btn.closest(".table_header");
      if (!th) return;
      clearColumnFilter(th);
    });
  });
});


//For - copy activity item
// Tooltip helper (z-index high so it appears above modals) - moved outside event handler for global access
  function showCopyTooltip(targetEl, text = "Copied!", duration = 3000) {
  // Remove any existing tooltips with the same class
  document.querySelectorAll('.bal-copy-tooltip').forEach(el => el.remove());
  
    const tip = document.createElement("div");
    tip.className = "bal-copy-tooltip";
    tip.textContent = text;

    Object.assign(tip.style, {
      position: "fixed",
      zIndex: "99999",
    padding: "8px 12px",
    background: "rgba(5, 102, 51, 0.9)",
      color: "#fff",
      fontSize: "12px",
    lineHeight: "1.2",
      borderRadius: "6px",
      boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
      pointerEvents: "none",
      opacity: "0",
      transform: "translate(-50%, -6px)",
    transition: "opacity 150ms ease",
    whiteSpace: "nowrap",
    maxWidth: "300px",
    textOverflow: "ellipsis",
    overflow: "hidden"
    });

    document.body.appendChild(tip);

    const r = targetEl.getBoundingClientRect();
  
  // Position above the element with some offset
  const top = Math.max(8, r.top - 30);
    const left = r.left + r.width / 2;

    tip.style.top = `${top}px`;
    tip.style.left = `${left}px`;

  // Make sure the tooltip is visible
  requestAnimationFrame(() => { 
    tip.style.opacity = "1"; 
    
    // Adjust position if tooltip is too wide
    const tipRect = tip.getBoundingClientRect();
    if (tipRect.width > 300) {
      tip.style.whiteSpace = "normal";
      tip.style.maxWidth = "300px";
    }
  });

    setTimeout(() => {
      tip.style.opacity = "0";
      setTimeout(() => tip.remove(), 180);
    }, duration);
  }

document.addEventListener("DOMContentLoaded", function () {

  // Clean text extractor (prefers .td-text, strips UI)
  function getCellCleanText(td) {
    const primary = td.querySelector(".td-text");
    if (primary) return primary.textContent.trim().replace(/\s+/g, " ");
    const clone = td.cloneNode(true);
    clone.querySelectorAll(
      "style,script,svg,button,.w-embed,.code-embed-150,.bal-name-td-icons,.th-btn-div"
    ).forEach(n => n.remove());
    return (clone.textContent || "").trim().replace(/\s+/g, " ");
  }
  
  // Helper to get activity name from a row
  function getActivityName(row) {
    // Try to find the activity name cell (4th column or with specific class)
    const activityNameCell = row.querySelector('td:nth-child(4)') || 
                            row.querySelector('td .td-text')?.closest('td') ||
                            row.querySelector('td[data-column="Activity Name"]');
    
    if (activityNameCell) {
      // If it's a complex cell with a text element inside
      const textElement = activityNameCell.querySelector('.td-text');
      if (textElement) {
        return textElement.textContent.trim();
      }
      // Otherwise just use the cell's text
      return activityNameCell.textContent.trim();
    }
    
    // Fallback: try to get data from the row's dataset
    if (row.dataset.activityData) {
      try {
        const data = JSON.parse(row.dataset.activityData);
        return data['Activity Name'] || '';
      } catch (e) {
        // console.error('Error parsing activity data:', e);
      }
    }
    
    return '';
  }
  
  // Add hover effect to copy buttons
  function setupCopyButtonHover() {
    const tables = document.querySelectorAll('table.table_component, #bal-table, .bal-table-saved');
    
    // Track active tooltip to avoid duplicates
    let activeTooltipTimer = null;
    let activeTooltipElement = null;
    
    tables.forEach(table => {
      // Use event delegation for better performance with dynamically added elements
      table.addEventListener('mouseover', function(e) {
        const copyBtn = e.target.closest('.btn-copy');
        if (!copyBtn) return;
        
        // Add hover class
        copyBtn.classList.add('hover');
        
        // Show a tooltip on hover
        const row = copyBtn.closest('tr');
        if (row) {
          const activityName = getActivityName(row);
          if (activityName) {
            // Store activity name in dataset for copy function
            copyBtn.dataset.activityName = activityName;
            
            // Clear any existing tooltip timer
            if (activeTooltipTimer) {
              clearTimeout(activeTooltipTimer);
              activeTooltipTimer = null;
            }
            
            // Show tooltip after a small delay to avoid flicker on quick mouse movements
            activeTooltipTimer = setTimeout(() => {
              // Show tooltip with custom message
              showCopyTooltip(copyBtn, `Click to copy: ${activityName.substring(0, 30)}${activityName.length > 30 ? '...' : ''}`, 1500);
              activeTooltipElement = copyBtn;
            }, 300);
          }
        }
      });
      
      table.addEventListener('mouseout', function(e) {
        const copyBtn = e.target.closest('.btn-copy');
        if (!copyBtn) return;
        
        // Remove hover class
        copyBtn.classList.remove('hover');
        
        // Clear tooltip timer if it exists
        if (activeTooltipTimer) {
          clearTimeout(activeTooltipTimer);
          activeTooltipTimer = null;
        }
      });
    });
  }
  
  // Call the setup function
  setupCopyButtonHover();

  // Get headers for the specific table
  function getTableHeaders(tableEl) {
    const ths = Array.from(tableEl.querySelectorAll("thead th"));
    if (!ths.length) return []; // fallback if no thead
    return ths.map(th => {
      const h = th.querySelector(".th-text");
      return (h ? h.textContent : th.textContent).trim().replace(/\s+/g, " ");
    });
  }

  // One global handler for ALL .btn-copy (main table + saved table)
  document.addEventListener("click", function (e) {
    const btn = e.target.closest(".btn-copy");
    if (!btn) return;

    // Avoid form submit or conflicting handlers
    e.preventDefault();
    e.stopPropagation();

    const row = btn.closest("tr");
    if (!row) return;
    
    // Get the activity name to copy
    let textToCopy = '';
    
    // First check if we have the activity name in the button's dataset (from hover)
    if (btn.dataset.activityName) {
      textToCopy = btn.dataset.activityName;
    } else {
      // If not, try to get it from the row
      textToCopy = getActivityName(row);
    }
    
    // If still no activity name, fall back to copying the entire row
    if (!textToCopy) {
      const table = row.closest("table");
      if (!table) return;

    const headers = getTableHeaders(table);
    const cells = Array.from(row.querySelectorAll("td")).map(getCellCleanText);

      textToCopy = (headers.length
      ? headers.slice(0, cells.length).map((h, i) => `${h}: ${cells[i]}`).join("\n")
      : cells.join("\n")
    );
    }

    // Copy the text to clipboard
    navigator.clipboard.writeText(textToCopy).then(() => {
      // Show the tooltip with simple "Copied!" message
      showCopyTooltip(btn, "Copied!", 2000);
      
      // Create and inject animation CSS if it doesn't exist
      if (!document.getElementById('copy-animation-style')) {
        const style = document.createElement('style');
        style.id = 'copy-animation-style';
        style.textContent = `
          @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(5, 102, 51, 0.7); }
            50% { transform: scale(1.1); box-shadow: 0 0 0 5px rgba(5, 102, 51, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(5, 102, 51, 0); }
          }
          
          .btn-copy-success {
            animation: pulse 0.8s ease-in-out;
          }
          
          .btn-copy.hover {
            transform: scale(1.1);
            box-shadow: 0 0 5px rgba(0,0,0,0.2);
            transition: all 0.2s ease;
          }
          
          .bal-copy-tooltip {
            font-weight: 500 !important;
            font-size: 12px !important;
          }
        `;
        document.head.appendChild(style);
      }
      
      // Add pulse animation to button
      btn.classList.add('btn-copy-success');
      
      // Change button color temporarily for visual feedback
      const originalColor = btn.style.color;
      btn.style.color = '#056633'; // Success color
      
      // Remove animation and restore color after animation completes
      setTimeout(() => {
        btn.classList.remove('btn-copy-success');
        btn.style.color = originalColor;
      }, 1000);
      
    }).catch(err => {
      // console.error("Failed to copy text:", err);
      showCopyTooltip(btn, "Copy failed", 3000);
    });
  });
});


// Toggle "is-saved" class on parent row
document.addEventListener('click', function (e) {
  if (e.target.closest('.btn-save')) {
    const row = e.target.closest('.table_row');
    if (row) {
      row.classList.toggle('is-saved');
('Toggled is-saved:', row);
    }
  }
});


//For - open BAL modal
document.addEventListener("DOMContentLoaded", () => {
  const table = document.querySelector(".bal-table #bal-table");
  const modal = document.querySelector(".bal-detail-popup");
  const modalBody = modal?.querySelector(".bal-detail-table-body");
  const closeBtn = modal?.querySelector(".bal-detail-popup-close");
  const overlay = modal?.querySelector(".bal-modal-overlay"); // close on overlay

  if (!table || !modal || !modalBody) return;

  // Get clean header texts (prefer .th-text if present)
  function getHeaders() {
    const ths = Array.from(table.querySelectorAll("thead th"));
    return ths.map(th => {
      const t = th.querySelector(".th-text");
      return (t ? t.textContent : th.textContent).trim().replace(/\s+/g, " ");
    });
  }

  // Extract a clean text from a cell
  function getCellText(td) {
    const primary = td.querySelector(".td-text");
    if (primary) return primary.textContent.trim().replace(/\s+/g, " ");

    const clone = td.cloneNode(true);
    // remove non-text UI elements
    clone.querySelectorAll(
      "style,script,svg,button,.w-embed,.code-embed-150,.bal-name-td-icons,.th-btn-div"
    ).forEach(n => n.remove());
    return (clone.textContent || "").trim().replace(/\s+/g, " ");
  }

  // Build modal rows for all columns
  function populateModalFromRow(row) {
    const headers = getHeaders();
    const cells = Array.from(row.querySelectorAll("td.table_cell"));
    // Clear old modal rows
    modalBody.innerHTML = "";

    headers.forEach((header, i) => {
      const val = cells[i] ? getCellText(cells[i]) : "";
      const tr = document.createElement("tr");
      tr.className = "bal-detail-table-row";

      const th = document.createElement("th");
      th.className = "bal-detail-table-cell _w-35";
      th.textContent = header;

      const td = document.createElement("td");
      td.className = "bal-detail-table-cell _w-65";
      td.textContent = val;

      tr.appendChild(th);
      tr.appendChild(td);
      modalBody.appendChild(tr);
    });
  }

  function openModal() { modal.classList.add("is-open"); }
  function closeModal() { modal.classList.remove("is-open"); }

  // Row click (ignore header and action buttons/links)
  table.addEventListener("click", (e) => {
    // 1) Ignore clicks in THEAD entirely
    if (e.target.closest("thead")) return;

    // 2) Ignore action controls
    if (e.target.closest(".btn-copy, .btn-save, .btn-search, .btn-clear, button, a")) return;

    // 3) Only allow rows inside TBODY
    const row = e.target.closest("tbody tr.table_row");
    if (!row) return;

    populateModalFromRow(row);
    openModal();
  });

  // Close via close button
  closeBtn?.addEventListener("click", (e) => { e.preventDefault(); closeModal(); });

  // Close via overlay click
  overlay?.addEventListener("click", (e) => { e.preventDefault(); closeModal(); });

  // ESC closes
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
});



//For - select list column 
document.addEventListener("DOMContentLoaded", function () {
  // Collect all column-select widgets inside .bal-table
  const selects = Array.from(document.querySelectorAll(".bal-table .bal-table-column-select"))
    .map(root => ({
      root,
      btn: root.querySelector(".bal-colum-show-btn"),
      dd: root.querySelector(".bal-colum-dropdown-wrapper")
    }))
    .filter(p => p.btn && p.dd);

  // Hide all dropdowns initially
  selects.forEach(p => {
    p.dd.style.display = "none";
    p.btn.setAttribute("aria-expanded", "false");
  });

  function closeAll(except) {
    selects.forEach(p => {
      if (except && p.root === except.root) return;
      p.dd.style.display = "none";
      p.btn.setAttribute("aria-expanded", "false");
    });
  }

  // Global click handler
  document.addEventListener("click", function (e) {
    // Click on a show button?
    const btn = e.target.closest(".bal-colum-show-btn");
    if (btn) {
      const current = selects.find(p => p.btn === btn || p.root.contains(btn));
      if (!current) return;

      e.preventDefault();
      e.stopPropagation(); // don't bubble to table row click handlers

      const willOpen = current.dd.style.display === "none";
      closeAll(current); // close others
      current.dd.style.display = willOpen ? "block" : "none";
      current.btn.setAttribute("aria-expanded", willOpen ? "true" : "false");
      return;
    }

    // Click inside any dropdown: do nothing (keep it open)
    if (e.target.closest(".bal-colum-dropdown-wrapper")) return;

    // Clicked outside: close all
    closeAll();
  });

  // ESC closes any open dropdown
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll();
  });
});



//For - modal open saved item 
document.addEventListener("DOMContentLoaded", function () {
  // Saved modal elements (scoped)
  const savedTriggers = document.querySelectorAll(".bal-saved"); // can be multiple
  const savedModal = document.querySelector(".bla-saved-modal");
  if (!savedModal || savedTriggers.length === 0) return;

  const overlay = savedModal.querySelector(".bal-modal-overlay");
  const closeBtn = savedModal.querySelector(".bal-detail-popup-close");
  const wrapper = savedModal.querySelector(".bal-modal-wrapper-saved");

  // Ensure closed on load (CSS should hide when not .is-open)
  savedModal.classList.remove("is-open");

  function openSavedModal(e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    savedModal.classList.add("is-open");
  }

  function closeSavedModal(e) {
    if (e) e.preventDefault();
    savedModal.classList.remove("is-open");
  }

  // Open handlers
  savedTriggers.forEach(btn => {
    btn.addEventListener("click", openSavedModal);
  });

  // Close handlers (overlay + close button)
  overlay?.addEventListener("click", closeSavedModal);
  closeBtn?.addEventListener("click", closeSavedModal);

  // Prevent clicks inside the modal wrapper from bubbling (safety)
  wrapper?.addEventListener("click", (e) => e.stopPropagation());

  // Optional: ESC closes only this modal (scoped check)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && savedModal.classList.contains("is-open")) {
      closeSavedModal();
    }
  });
});

// Additional check for saved items table after page load
document.addEventListener('DOMContentLoaded', () => {
  // Add direct event handler for search form
  const searchForm = document.querySelector('#wf-form-searchInput, form[name="wf-form-searchInput"]');
  if (searchForm) {
  ("Adding direct event handler to search form");
    
    // Prevent default form submission
    searchForm.addEventListener('submit', function(e) {
("Direct form submit handler triggered");
      e.preventDefault();
      e.stopPropagation();
      return false;
    });
    
    // Set onsubmit directly
    searchForm.onsubmit = function() {
("Direct onsubmit handler triggered");
      return false;
    };
    
    // Set up search-on-type for the search input
    const directSearchInput = document.querySelector('#search-input, .bal-search-input, input[name="searchInput"]');
    if (directSearchInput) {
("Setting up direct search-on-type handler");
      
      // Set up search-on-type with debounce
      let directSearchTimeout;
      directSearchInput.addEventListener('input', () => {
        clearTimeout(directSearchTimeout);
        directSearchTimeout = setTimeout(() => {
          const searchTerm = directSearchInput.value.trim();
    (`Direct search-on-type triggered with term: ${searchTerm}`);
          
          // Trigger search if business-activity.js is loaded
          if (window.state && typeof window.renderPage === 'function') {
            window.state.searchTerm = searchTerm;
            window.state.currentPage = 1;
            window.renderPage(1);
          }
        }, 350); // 350ms debounce time
      });
    }
    
    // Handle search button click
    const searchBtn = document.querySelector('.bal-search-submit');
    if (searchBtn) {
("Adding direct event handler to search button");
      searchBtn.addEventListener('click', function(e) {
  ("Direct search button click handler triggered");
        e.preventDefault();
        e.stopPropagation();
        
        // Find the search input using multiple strategies
        let searchInput = null;
        
        // Strategy 1: Find in the same form
        const form = searchBtn.closest('form');
        if (form) {
          searchInput = form.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
    ("Search input found in form (direct handler):", !!searchInput);
        }
        
        // Strategy 2: Find in the same container
        if (!searchInput) {
          const searchContainer = searchBtn.closest('.bal-search');
          if (searchContainer) {
            searchInput = searchContainer.querySelector('input');
      ("Search input found in container (direct handler):", !!searchInput);
          }
        }
        
        // Strategy 3: Find by ID or class anywhere
        if (!searchInput) {
          searchInput = document.querySelector('#search-input, .bal-search-input');
    ("Search input found by selector (direct handler):", !!searchInput);
        }
        
        // Use the input if found
        if (searchInput) {
          const searchTerm = searchInput.value.trim();
    ("Search term from direct handler:", searchTerm);
          
          // Trigger search if business-activity.js is loaded
          if (window.state && typeof window.renderPage === 'function') {
            window.state.searchTerm = searchTerm;
            window.state.currentPage = 1;
            window.renderPage(1);
          }
        } else {
          // console.error("Could not find search input in any location");
        }
        
        return false;
      });
    }
  }
  
  setTimeout(() => {
  ("Checking for saved table elements after page load...");
    const savedTable = document.querySelector('.bal-table-saved, #saved_list_table');
  ("Saved table found:", !!savedTable);
    
    if (savedTable) {
("Saved table ID:", savedTable.id);
("Saved table class:", savedTable.className);
      
      const savedTableBody = savedTable.querySelector('tbody, .bal-table-saved-tbody');
("Saved table body found:", !!savedTableBody);
      
      if (savedTableBody) {
  ("Saved table body class:", savedTableBody.className);
        
        // Try to render saved items again
        const savedActivities = JSON.parse(localStorage.getItem('savedActivities') || '[]');
  (`Found ${savedActivities.length} saved activities`);
        
        // Check for saved count elements
        const savedCountEls = document.querySelectorAll('.saved-count');
  (`Found ${savedCountEls.length} saved-count elements`);
        if (savedCountEls.length > 0) {
    ("Updating all saved count elements...");
          updateSavedItemsCount(savedActivities.length);
        }
        
        if (savedActivities.length > 0) {
          // Clear the placeholder content
          savedTableBody.innerHTML = '';
          
          // Add each saved activity to the table
          savedActivities.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'bal-table-saved-trow';
            
            // Group column
            const groupCell = document.createElement('td');
            groupCell.className = 'bal-table-saved-td';
            groupCell.textContent = item.Group || '';
            row.appendChild(groupCell);
            
            // Category column
            const categoryCell = document.createElement('td');
            categoryCell.className = 'bal-table-saved-td';
            categoryCell.textContent = item.Category || '';
            row.appendChild(categoryCell);
            
            // Activity Name column with icons
            const nameCell = document.createElement('td');
            nameCell.className = 'bal-table-saved-td';
            
            const nameDiv = document.createElement('div');
            nameDiv.className = 'bal-table-td-div';
            
            const nameText = document.createElement('p');
            nameText.className = 'td-text';
            nameText.textContent = item['Activity Name'] || '';
            nameDiv.appendChild(nameText);
            
            // Add icons container
            const iconsDiv = document.createElement('div');
            iconsDiv.className = 'bal-name-td-icons';
            
            // Copy button
            const copyBtnDiv = document.createElement('div');
            copyBtnDiv.className = 'code-embed-150 w-embed';
            const copyButton = document.createElement('button');
            copyButton.type = 'submit';
            copyButton.className = 'btn-copy';
            copyButton.setAttribute('aria-label', 'Copy');
            copyButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="13" viewBox="0 0 10 13" fill="none">
  <path d="M5.5 10.5C6.1628 10.4992 6.79822 10.2356 7.26689 9.7669C7.73556 9.29823 7.99921 8.66281 8 8.00001V3.62151C8.00078 3.35869 7.94938 3.09833 7.84879 2.85552C7.7482 2.61271 7.60041 2.39228 7.414 2.20701L6.293 1.08601C6.10773 0.899596 5.8873 0.75181 5.64449 0.651219C5.40168 0.550627 5.14132 0.499231 4.8785 0.500009H2.5C1.8372 0.500803 1.20178 0.76445 0.73311 1.23312C0.264441 1.70179 0.000793929 2.33721 0 3.00001V8.00001C0.000793929 8.66281 0.264441 9.29823 0.73311 9.7669C1.20178 10.2356 1.8372 10.4992 2.5 10.5H5.5ZM1 8.00001V3.00001C1 2.60218 1.15804 2.22065 1.43934 1.93935C1.72064 1.65804 2.10218 1.50001 2.5 1.50001C2.5 1.50001 4.9595 1.50701 5 1.51201V2.50001C5 2.76523 5.10536 3.01958 5.29289 3.20712C5.48043 3.39465 5.73478 3.50001 6 3.50001H6.988C6.993 3.54051 7 8.00001 7 8.00001C7 8.39783 6.84196 8.77936 6.56066 9.06067C6.27936 9.34197 5.89782 9.50001 5.5 9.50001H2.5C2.10218 9.50001 1.72064 9.34197 1.43934 9.06067C1.15804 8.77936 1 8.39783 1 8.00001ZM10 4.50001V10C9.99921 10.6628 9.73556 11.2982 9.26689 11.7669C8.79822 12.2356 8.1628 12.4992 7.5 12.5H3C2.86739 12.5 2.74021 12.4473 2.64645 12.3536C2.55268 12.2598 2.5 12.1326 2.5 12C2.5 11.8674 2.55268 11.7402 2.64645 11.6465C2.74021 11.5527 2.86739 11.5 3 11.5H7.5C7.89782 11.5 8.27936 11.342 8.56066 11.0607C8.84196 10.7794 9 10.3978 9 10V4.50001C9 4.3674 9.05268 4.24022 9.14645 4.14646C9.24021 4.05269 9.36739 4.00001 9.5 4.00001C9.63261 4.00001 9.75979 4.05269 9.85355 4.14646C9.94732 4.24022 10 4.3674 10 4.50001Z" fill="black" fill-opacity="0.6"/>
</svg>`;
            
            // Add click event to copy activity name
            copyButton.addEventListener('click', (event) => {
              event.stopPropagation();
              const textToCopy = item['Activity Name'] || '';
              navigator.clipboard.writeText(textToCopy)
                .then(() => {
                  // Show feedback
                  const originalColor = copyButton.style.color;
                  copyButton.style.color = '#056633';
                  setTimeout(() => {
                    copyButton.style.color = originalColor;
                  }, 1000);
                })
                .catch(err => {
                  // console.error('Failed to copy text:', err);
                });
            });
            
            copyBtnDiv.appendChild(copyButton);
            
            // Remove button (using save button style)
            const removeBtnDiv = document.createElement('div');
            removeBtnDiv.className = 'code-embed-150 w-embed';
            const removeButton = document.createElement('button');
            removeButton.type = 'submit';
            removeButton.className = 'btn-save saved';
            removeButton.setAttribute('aria-label', 'Remove');
            removeButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="11" height="13" viewBox="0 0 11 13" fill="none">
  <path d="M0.924587 12.3277C1.19761 12.4444 1.49946 12.4761 1.79076 12.4187C2.08207 12.3612 2.34929 12.2173 2.55759 12.0057L5.50009 9.07924L8.44259 12.0057C8.57979 12.1449 8.74323 12.2555 8.92346 12.3312C9.1037 12.4068 9.29714 12.4459 9.49259 12.4462C9.69349 12.4457 9.8923 12.4054 10.0776 12.3277C10.3528 12.2163 10.5881 12.0245 10.7527 11.7774C10.9173 11.5302 11.0035 11.2392 11.0001 10.9422V3.05273C10.9993 2.38994 10.7356 1.75451 10.267 1.28584C9.79831 0.817175 9.16288 0.553528 8.50009 0.552734L2.50009 0.552734C1.83729 0.553528 1.20187 0.817175 0.733197 1.28584C0.264528 1.75451 0.000881002 2.38994 8.70731e-05 3.05273V10.9422C-0.00313951 11.2394 0.0833752 11.5306 0.248319 11.7778C0.413262 12.025 0.648958 12.2167 0.924587 12.3277Z" fill="#06603A"/>
</svg>`;
            
            // Add click event to remove item
            removeButton.addEventListener('click', (event) => {
              event.stopPropagation();
              
              // Remove from saved items
              const updatedSaved = savedActivities.filter(act => act.Code !== item.Code);
              localStorage.setItem('savedActivities', JSON.stringify(updatedSaved));
              
              // Update saved count display
              updateSavedItemsCount(updatedSaved.length);
              
              // Remove this row
              row.remove();
              
              // If no items left, show empty state
              if (updatedSaved.length === 0) {
                const emptyRow = document.createElement('tr');
                emptyRow.className = 'bal-table-saved-trow';
                
                const emptyCell = document.createElement('td');
                emptyCell.className = 'bal-table-saved-td';
                emptyCell.colSpan = 3;
                emptyCell.textContent = 'No saved activities';
                emptyCell.style.textAlign = 'center';
                emptyCell.style.padding = '20px';
                
                emptyRow.appendChild(emptyCell);
                savedTableBody.appendChild(emptyRow);
              }
              
              // Update main table if the item is visible there
              const mainTableRow = document.querySelector(`.table_row[data-activity-code="${item.Code}"]`);
              if (mainTableRow) {
                mainTableRow.classList.remove('is-saved');
                const saveBtn = mainTableRow.querySelector('.btn-save');
                if (saveBtn) {
                  saveBtn.classList.remove('saved');
                  const svgPath = saveBtn.querySelector('svg path');
                  if (svgPath) svgPath.setAttribute('stroke', '#6B7094');
                }
              }
            });
            
            removeBtnDiv.appendChild(removeButton);
            
            iconsDiv.appendChild(copyBtnDiv);
            iconsDiv.appendChild(removeBtnDiv);
            nameDiv.appendChild(iconsDiv);
            nameCell.appendChild(nameDiv);
            row.appendChild(nameCell);
            
            // Store activity code for reference
            row.dataset.activityCode = item.Code;
            
            savedTableBody.appendChild(row);
          });
        }
      }
    }
    
    // List all tables on the page for debugging
  ("All tables on the page:");
    document.querySelectorAll('table').forEach((table, index) => {
(`Table ${index}:`, table.id, table.className);
    });
  }, 1000);
});
