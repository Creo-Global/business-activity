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
  const SUPABASE_URL = 'https://sb.meydanfz.ae';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzU3MjQyMDM2LCJleHAiOjIwNzI4MTgwMzZ9.5YF79Wen41bSpKNOKiT9Wcd_psXf8IV4vgK7RUjOZoI';

  // ─── State Management ──────────────────────────────────────────
  // Centralized state for the component
  const state = {
    currentPage: 1,
    currentCategory: '',
    currentGroup: '',
    searchTerm: '',
    columnFilters: '',
    savedItems: [], 
    thirdPartyApproval: false, // Toggle for third party approval filter
    selectedThirdParties: new Set(), // Set of selected third party filters
    // Multi-select state for mobile filters
    selectedGroups: new Set(),
    selectedCategories: new Set(),
    selectedCodes: new Set(),
  selectedApprovalStages: new Set(), // Set of selected approval stages (PRE, POST, null)
  selectedRiskRatings: new Set(), // Set of selected risk ratings (Low, Medium, High, Override)
    codeSortOrder: 'ascending', // 'ascending' or 'descending'
    fawriMode: false, // Toggle for FAWRI Activities (Low and Medium risk only)
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
    // Mobile container elements
    mobileListEl: document.querySelector('.bal-mobile-list, .mobile-activities-container'),
    categoryContainers: document.querySelectorAll('.bal-category-lists'),
    categoryItems: document.querySelectorAll('.bal-cat-item'),
    // Main search elements
    searchForm: document.querySelector('#wf-form-searchInput, form[name="wf-form-searchInput"]'),
    searchEl: document.querySelector('#search-input, .bal-search-input, input[type="search"], #global-search, .search-input'),
    // Multiple search inputs (for desktop and mobile)
    searchInputs: document.querySelectorAll('#search-input, .bal-search-input, input[name="searchInput"], .main-search input[type="text"]'),
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
    // FAWRI Activities toggle elements (Desktop)
    fawriToggleWrapper: document.querySelector('.bal-tab-desktop-nav'),
    regularActivitiesTab: document.querySelector('.bla-tab-nav-click:first-child'),
    fawriActivitiesTab: document.querySelector('.bla-tab-nav-click:last-child'),
    // FAWRI Activities toggle elements (Mobile)
    mobileFawriToggleWrapper: document.querySelector('.bal-swich-tab'),
    mobileRegularActivitiesTab: document.querySelector('.bal-tab-click:first-child'),
    mobileFawriActivitiesTab: document.querySelector('.bal-tab-click:last-child'),
    // Mobile sorting/filtering tabs
    mobileSortingTabs: document.querySelector('.fiter-by-tab.w-tabs'),
    mobileGroupTab: document.querySelector('.fiter-by-tab [data-w-tab="Tab 1"]'),
    mobileCategoriesTab: document.querySelector('.fiter-by-tab [data-w-tab="Tab 2"]'),
    mobileCodeTab: document.querySelector('.fiter-by-tab [data-w-tab="Tab 3"]'),
    // Mobile sorting modal triggers (tabs that open modals)
    mobileGroupModal: document.querySelector('[data-modal="group"]'),
    mobileCategoriesModal: document.querySelector('[data-modal="categories"]'),
    mobileCodeModal: document.querySelector('[data-modal="code"]'),
    // Existing mobile filter modals
    mobileFilterModals: document.querySelectorAll('.filter-slide-wrap'),
    mobileGroupFilterModal: document.querySelector('[data-id="group"]'),
    mobileCategoriesFilterModal: document.querySelector('[data-id="categories"], [data-id="category"]'),
    mobileCodeFilterModal: document.querySelector('[data-id="code"]'),
    mobileThirdPartyFilterModal: document.querySelector('[data-id="thirdparty"]'),
    mobileGroupCheckboxContainer: null, // Will be populated dynamically
    mobileCategoriesCheckboxContainer: null, // Will be populated dynamically
    mobileCodeCheckboxContainer: null, // Will be populated dynamically
    mobileThirdPartyCheckboxContainer: null, // Will be populated dynamically
    // Saved items table elements
    savedTable: document.querySelector('.bal-table-saved, #saved_list_table'),
    savedTableBody: document.querySelector('.bal-table-saved-tbody, #saved_list_table tbody, .bal-table-saved tbody'),
    savedItemsCount: document.querySelectorAll('.saved-items-count, .saved-count'),
    // Mobile saved items container
    savedMobileContainer: document.querySelector('.bal-wrapper.for-mobile.saaved-items, .bal-wrapper.for-mobile.saved-items'),
    // Third party approval elements
    thirdPartyToggle: document.querySelector('#select_all, #select_all_item'),
    thirdPartyDropdown: document.querySelector('.third-party-approval'),
    thirdPartyCheckboxes: document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]'),
    unselectAllBtn: document.querySelector('.unselect-all'),
    resetBtn: document.querySelector('.reset-item, .reset-all'),
  };

      // ─── Utility Functions ─────────────────────────────────────────

  // Helper to fire a change event so any UI library (e.g., Webflow) updates visuals
  function triggerChange(el) {
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function isMobileView() {
    return window.innerWidth <= 991; // Mobile view starts at 991px and below
  }

  function createMobileItem(item) {
    // Create the main wrapper
    const balWrapper = document.createElement('div');
    balWrapper.className = 'bal-wrapper';
    
    // Create the table row container
    const balItem = document.createElement('div');
    balItem.className = 'bal-item table_row';
    balItem.dataset.activityCode = item.Code;
    balItem.dataset.activityData = JSON.stringify(item);
    
    // Create the group section
    const balItemGroup = document.createElement('div');
    balItemGroup.className = 'bal-item-group';
    
    const groupNumber = document.createElement('div');
    groupNumber.className = 'bal-group-number';
    groupNumber.textContent = item.Group || '';
    
    const groupText = document.createElement('div');
    groupText.className = 'text-block-352';
    groupText.textContent = 'Group';
    
    balItemGroup.appendChild(groupNumber);
    balItemGroup.appendChild(groupText);
    
    // Create the name section
    const balItemName = document.createElement('div');
    balItemName.className = 'bal-item-name';
    
    const baName = document.createElement('p');
    baName.className = 'ba-name';
    baName.textContent = item['Activity Name'] || '';
    
    const baLabels = document.createElement('div');
    baLabels.className = 'ba-labels';
    
    // Add DNFBP label if exists and not null/N/A/NO
    const dnfbpValue = item.DNFBP ? item.DNFBP.toString().trim().toUpperCase() : '';
    if (item.DNFBP && 
        dnfbpValue !== 'N/A' && 
        dnfbpValue !== 'NO' && 
        dnfbpValue !== 'NULL' &&
        dnfbpValue !== '' &&
        dnfbpValue !== 'UNDEFINED') {
      const dnfbpLabel = document.createElement('div');
      dnfbpLabel.className = 'ba-label';
      dnfbpLabel.textContent = 'DNFBP';
      baLabels.appendChild(dnfbpLabel);
    }
    
    // Add approval stage label based on actual data
    if (item['When']) {
      const approvalLabel = document.createElement('div');
      approvalLabel.className = 'ba-label';
      
      // Convert database values to display text
      switch (item['When']) {
        case 'PRE':
          approvalLabel.textContent = 'Pre Approval';
          break;
        case 'POST':
          approvalLabel.textContent = 'Post Approval';
          break;
        default:
          // If it's not PRE or POST, show the actual value
          approvalLabel.textContent = item['When'];
      }
      baLabels.appendChild(approvalLabel);
    }
    
    balItemName.appendChild(baName);
    balItemName.appendChild(baLabels);
    
    // Create the code section
    const balItemCode = document.createElement('div');
    balItemCode.className = 'bal-item-code';
    
    const codeNumber = document.createElement('div');
    codeNumber.className = 'bal-group-number';
    codeNumber.textContent = item.Code || '';
    
    const codeText = document.createElement('div');
    codeText.className = 'text-block-352';
    codeText.textContent = 'Code';
    
    balItemCode.appendChild(codeNumber);
    balItemCode.appendChild(codeText);
    
    // Create the save section
    const balItemSave = document.createElement('div');
    balItemSave.className = 'bal-item-save';
    
    const codeEmbed = document.createElement('div');
    codeEmbed.className = 'code-embed-150 w-embed';
    
    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.className = 'btn-save';
    saveButton.setAttribute('aria-label', 'Save');
    saveButton.innerHTML = `<svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8.49902 1.05273L8.69727 1.0625C9.15499 1.10845 9.58495 1.31153 9.91309 1.63965C10.2412 1.96777 10.4443 2.39776 10.4902 2.85547L10.5 3.05371V10.9482C10.5022 11.1444 10.4455 11.3367 10.3369 11.5C10.2281 11.6635 10.0717 11.7906 9.88965 11.8643L9.88477 11.8662C9.76055 11.9183 9.62686 11.9448 9.49219 11.9453C9.36339 11.9449 9.23598 11.9199 9.11719 11.8701C8.99793 11.8201 8.88961 11.7464 8.79883 11.6543L8.79492 11.6514L5.85254 8.72461L5.5 8.37402L5.14746 8.72461L2.20508 11.6514L2.20117 11.6553C2.06351 11.795 1.88679 11.8897 1.69434 11.9277C1.54982 11.9562 1.40114 11.9517 1.25977 11.915L1.12109 11.8682L1.11133 11.8643L0.980469 11.7988C0.854533 11.7245 0.745917 11.6227 0.664062 11.5C0.555089 11.3366 0.497867 11.1437 0.5 10.9473V3.05371C0.500635 2.52333 0.711894 2.01469 1.08691 1.63965C1.41502 1.31155 1.84505 1.10849 2.30273 1.0625L2.50098 1.05273H8.49902Z" stroke="#6B7094"/>
    </svg>`;
    
    // Add save functionality
    saveButton.addEventListener('click', (event) => {
      event.stopPropagation();
      toggleSavedItem(item, saveButton, balItem);
    });
    
    // Check if item is already saved
    if (isItemSaved(item.Code)) {
      saveButton.classList.add('saved');
      saveButton.querySelector('svg path').setAttribute('stroke', '#06603A');
      balItem.classList.add('is-saved');
    }
    
    // Add styles for save button
    const style = document.createElement('style');
    style.textContent = '.btn-save { background-color: transparent; }';
    codeEmbed.appendChild(saveButton);
    codeEmbed.appendChild(style);
    
    balItemSave.appendChild(codeEmbed);
    
    // Assemble the item
    balItem.appendChild(balItemGroup);
    balItem.appendChild(balItemName);
    balItem.appendChild(balItemCode);
    balItem.appendChild(balItemSave);
    
    // Add click event to show modal
    balItem.style.cursor = 'pointer';
    balItem.addEventListener('click', (event) => {
      // Ignore clicks on buttons (copy, save, etc.)
      if (event.target.closest('.btn-copy, .btn-save, button')) {
        return;
      }
      event.stopPropagation();
      showActivityDetailsModal(item);
    });
    
    balWrapper.appendChild(balItem);
    return balWrapper;
  }

  function createMobileSavedItem(item) {
    // Create the table row container for saved items (no wrapper div needed as it goes inside existing wrapper)
    const balItem = document.createElement('div');
    balItem.className = 'bal-item table_row';
    balItem.dataset.activityCode = item.Code;
    balItem.dataset.activityData = JSON.stringify(item);
    
    // Create the group section
    const balItemGroup = document.createElement('div');
    balItemGroup.className = 'bal-item-group';
    
    const groupNumber = document.createElement('div');
    groupNumber.className = 'bal-group-number';
    groupNumber.textContent = item.Group || '';
    
    const groupText = document.createElement('div');
    groupText.className = 'text-block-352';
    groupText.textContent = 'Group';
    
    balItemGroup.appendChild(groupNumber);
    balItemGroup.appendChild(groupText);
    
    // Create the name section
    const balItemName = document.createElement('div');
    balItemName.className = 'bal-item-name';
    
    const baName = document.createElement('p');
    baName.className = 'ba-name';
    baName.textContent = item['Activity Name'] || '';
    
    const baLabels = document.createElement('div');
    baLabels.className = 'ba-labels';
    
    // Add DNFBP label if exists and not null/N/A/NO
    const dnfbpValue = item.DNFBP ? item.DNFBP.toString().trim().toUpperCase() : '';
    if (item.DNFBP && 
        dnfbpValue !== 'N/A' && 
        dnfbpValue !== 'NO' && 
        dnfbpValue !== 'NULL' &&
        dnfbpValue !== '' &&
        dnfbpValue !== 'UNDEFINED') {
      const dnfbpLabel = document.createElement('div');
      dnfbpLabel.className = 'ba-label';
      dnfbpLabel.textContent = 'DNFBP';
      baLabels.appendChild(dnfbpLabel);
    }
    
    // Add approval stage label based on actual data
    if (item['When']) {
      const approvalLabel = document.createElement('div');
      approvalLabel.className = 'ba-label';
      
      // Convert database values to display text
      switch (item['When']) {
        case 'PRE':
          approvalLabel.textContent = 'Pre Approval';
          break;
        case 'POST':
          approvalLabel.textContent = 'Post Approval';
          break;
        default:
          // If it's not PRE or POST, show the actual value
          approvalLabel.textContent = item['When'];
      }
      baLabels.appendChild(approvalLabel);
    }
    
    balItemName.appendChild(baName);
    balItemName.appendChild(baLabels);
    
    // Create the code section
    const balItemCode = document.createElement('div');
    balItemCode.className = 'bal-item-code';
    
    const codeNumber = document.createElement('div');
    codeNumber.className = 'bal-group-number';
    codeNumber.textContent = item.Code || '';
    
    const codeText = document.createElement('div');
    codeText.className = 'text-block-352';
    codeText.textContent = 'Code';
    
    balItemCode.appendChild(codeNumber);
    balItemCode.appendChild(codeText);
    
    // Create the save section (remove button for saved items)
    const balItemSave = document.createElement('div');
    balItemSave.className = 'bal-item-save';
    
    const codeEmbed = document.createElement('div');
    codeEmbed.className = 'code-embed-150 w-embed';
    
    const removeButton = document.createElement('button');
    removeButton.type = 'submit';
    removeButton.className = 'btn-save saved';
    removeButton.setAttribute('aria-label', 'Remove');
    removeButton.innerHTML = `<svg width="11" height="13" viewBox="0 0 11 13" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L5.5 9L1 12V1C1 0.734784 1.10536 0.48043 1.29289 0.292893C1.48043 0.105357 1.73478 0 2 0H9C9.26522 0 9.51957 0.105357 9.70711 0.292893C9.89464 0.48043 10 0.734784 10 1V12Z" stroke="#056633" fill="#056633" fill-opacity="1" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    
    // Add remove functionality
    removeButton.addEventListener('click', (event) => {
      event.stopPropagation();
      
      // Remove from saved items
      const savedActivities = getSavedActivities();
      const updatedSaved = savedActivities.filter(act => act.Code !== item.Code);
      saveSavedActivities(updatedSaved);
      
      // Update saved items display
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
    
    // Add styles for remove button
    const style = document.createElement('style');
    style.textContent = '.btn-save { background-color: transparent; }';
    codeEmbed.appendChild(removeButton);
    codeEmbed.appendChild(style);
    
    balItemSave.appendChild(codeEmbed);
    
    // Assemble the item
    balItem.appendChild(balItemGroup);
    balItem.appendChild(balItemName);
    balItem.appendChild(balItemCode);
    balItem.appendChild(balItemSave);
    
    // Add click event to show modal
    balItem.style.cursor = 'pointer';
    balItem.addEventListener('click', (event) => {
      // Ignore clicks on buttons (copy, save, etc.)
      if (event.target.closest('.btn-copy, .btn-save, button')) {
        return;
      }
      event.stopPropagation();
      showActivityDetailsModal(item);
    });
    
    return balItem;
  }

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

  function showLoader() {
    if (isMobileView() && dom.mobileListEl) {
      // Mobile view - show loader in mobile container
      const existingLoader = dom.mobileListEl.querySelector('.loader-container');
      if (existingLoader) existingLoader.remove();
      dom.mobileListEl.innerHTML = '';
      dom.mobileListEl.appendChild(createLoader());
    } else if (dom.tableBodyEl) {
      // Desktop view - show loader in table
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
  }

  function hideLoader() {
    if (isMobileView() && dom.mobileListEl) {
      // Mobile view - remove loader from mobile container
      const loader = dom.mobileListEl.querySelector('.loader-container');
      if (loader) loader.remove();
    } else if (dom.tableBodyEl) {
      // Desktop view - remove loader from table
    const loaderRow = dom.tableBodyEl.querySelector('.loader-container');
    if (loaderRow) {
      const parentRow = loaderRow.closest('tr');
      if (parentRow) parentRow.remove();
      else loaderRow.remove();
      }
    }
  }

  function updateActiveGroupDisplay() {
    if (dom.activeGroupSpan) {
      const displayText = state.currentCategory || 'All Categories';
      dom.activeGroupSpan.textContent = displayText;
    }
  }

  // ─── Mobile Sorting/Filtering Logic ─────────────────────────────

  async function initMobileSorting() {

    if (!dom.mobileSortingTabs) {
    
      return;
    }
    
    try {
    // Fetch categories, groups, codes, and third parties from database
    const { data, error } = await supabase.from('Activity List').select('Category, Group, Code, "Third Party"');
      if (error) {
        // 
        return;
      }
      
      // Extract unique values
      const categories = Array.from(new Set(data.map(r => r.Category).filter(Boolean))).sort();
      const groups = Array.from(new Set(data.map(r => r.Group).filter(Boolean))).sort();
      const codes = Array.from(new Set(data.map(r => r.Code).filter(Boolean))).sort();
    
      const thirdParties = Array.from(new Set(data.map(r => r['Third Party']).filter(Boolean))).sort();

      // Find and populate existing modal containers
      findMobileModalContainers();
      populateExistingModals(categories, groups, codes, thirdParties);
      
      // Set up mobile sorting functionality
      setupMobileSortingTabs();
      
      // Set up footer buttons for all modals (with delay to ensure DOM is ready)
    
      setTimeout(() => {
        // setupModalFooterButtons(); // Disabled - using modal management system instead
      }, 500);
      
      // Initialize display
      updateMobileSortingDisplay();
      
    } catch (error) {
      // 
    }
  }
  
  function findMobileModalContainers() {

    // Debug: log all elements with data-id attributes
    const allDataIdElements = document.querySelectorAll('[data-id]');

    // Look for modals with specific data-id attributes
    const groupModal = document.querySelector('[data-id="group"]');
    const categoriesModal = document.querySelector('[data-id="categories"]') || document.querySelector('[data-id="category"]');
    const codeModal = document.querySelector('[data-id="code"]');
    const thirdPartyModal = document.querySelector('[data-id="thirdparty"]');
    
    if (groupModal) {
    
      const groupCheckboxContainer = groupModal.querySelector('.bal-dropdown-checkbox-wrap.select-listing');
    
      if (groupCheckboxContainer) {
      
        dom.mobileGroupCheckboxContainer = groupCheckboxContainer;
      }
    } else {
    
    }
    
    if (categoriesModal) {
    
      const categoriesCheckboxContainer = categoriesModal.querySelector('.bal-dropdown-checkbox-wrap.select-listing');
    
      if (categoriesCheckboxContainer) {
      
        dom.mobileCategoriesCheckboxContainer = categoriesCheckboxContainer;
      }
    } else {
  
    }
    
    if (codeModal) {
    
      const codeCheckboxContainer = codeModal.querySelector('.bal-dropdown-checkbox-wrap.select-listing');
    
      if (codeCheckboxContainer) {
      
        dom.mobileCodeCheckboxContainer = codeCheckboxContainer;
      }
    } else {
    
    }
    
    if (thirdPartyModal) {

      const thirdPartyCheckboxContainer = thirdPartyModal.querySelector('.bal-dropdown-checkbox-wrap.select-listing');
    
      if (thirdPartyCheckboxContainer) {

        dom.mobileThirdPartyCheckboxContainer = thirdPartyCheckboxContainer;
    } else {

      }
    } else {

    }
    
    // Fallback: if data-id approach doesn't work, use the search input placeholder method
    if (!dom.mobileGroupCheckboxContainer || !dom.mobileCategoriesCheckboxContainer) {
    
      const filterModals = document.querySelectorAll('.filter-slide-wrap');
      
      filterModals.forEach((modal, index) => {
        const searchInput = modal.querySelector('input[placeholder*="group"]');
        const checkboxContainer = modal.querySelector('.bal-dropdown-checkbox-wrap.select-listing');
        
        if (searchInput && searchInput.placeholder.includes('group') && !dom.mobileGroupCheckboxContainer) {
        
          dom.mobileGroupCheckboxContainer = checkboxContainer;
        } else if (checkboxContainer && !dom.mobileCategoriesCheckboxContainer) {
        
          dom.mobileCategoriesCheckboxContainer = checkboxContainer;
        }
      });
    }
  }
  
  function populateExistingModals(categories, groups, codes, thirdParties) {

    // Populate groups modal
    if (dom.mobileGroupCheckboxContainer) {
    populateCheckboxContainer(dom.mobileGroupCheckboxContainer, groups, 'group');
    }
    
    // Populate categories modal
    if (dom.mobileCategoriesCheckboxContainer) {
    populateCheckboxContainer(dom.mobileCategoriesCheckboxContainer, categories, 'category');
    }
    
    // Populate codes modal
    if (dom.mobileCodeCheckboxContainer) {
    populateCheckboxContainer(dom.mobileCodeCheckboxContainer, codes, 'code');
    }
    
  // Populate third party modal with all data from database (like desktop version)

    if (dom.mobileThirdPartyCheckboxContainer) {

    if (thirdParties && thirdParties.length > 0) {
      populateThirdPartyModal(dom.mobileThirdPartyCheckboxContainer, thirdParties);
    } else {

    }
  } else {

  }
}

function populateCheckboxContainer(container, items, type) {
  // Clear ALL existing checkboxes (including any pre-existing "Select All")
  const existingItems = container.querySelectorAll('.bal-dropdown-link');
  existingItems.forEach(item => {
    item.remove();
  });

  // Note: We're not adding a "Select All" option anymore
    
    // Add new items from database
    items.forEach((item, index) => {
      const checkboxLink = document.createElement('div');
      checkboxLink.className = 'bal-dropdown-link select-category';
      checkboxLink.setAttribute('data-item-index', index);
      checkboxLink.setAttribute('data-item-name', item);
      
      const checkboxField = document.createElement('label');
      checkboxField.className = 'w-checkbox bal-checkbox-field check-list';
      
      const hiddenInput = document.createElement('input');
      hiddenInput.type = 'checkbox';
      hiddenInput.name = `${type}-${index}`;
      hiddenInput.id = `${type}-${index}-${Date.now()}`; // Ensure unique IDs
      hiddenInput.dataset.name = item;
      hiddenInput.dataset.type = type;
      hiddenInput.dataset.index = index;
      hiddenInput.style.cssText = 'opacity:0;position:absolute;z-index:-1';
      
      const checkboxInput = document.createElement('div');
      checkboxInput.className = 'w-checkbox-input w-checkbox-input--inputType-custom bal-checkbox';
      
      const label = document.createElement('span');
      label.className = 'bal-checkbox-label w-form-label';
      label.setAttribute('for', hiddenInput.id);
      label.textContent = item;
      
      checkboxField.appendChild(hiddenInput);
      checkboxField.appendChild(checkboxInput);
      checkboxField.appendChild(label);
      checkboxLink.appendChild(checkboxField);
      
      // Add click event
    checkboxLink.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle the checkbox state first
      hiddenInput.checked = !hiddenInput.checked;
      
      // Let handleMobileCheckboxSelection handle all visual updates
      handleMobileCheckboxSelection(type, item, hiddenInput);
      });
      
      container.appendChild(checkboxLink);
    });
    
    // Update checkbox states after all items are created
    // Use requestAnimationFrame for better timing than setTimeout
    requestAnimationFrame(() => {
      updateMobileCheckboxStates(type);
    });
    
    // Note: No "Select All" functionality - each item is individually selectable
  }
  
function setupThirdPartyEventHandlers(container) {

  // Find all existing checkbox links in the container
    const checkboxLinks = container.querySelectorAll('.bal-dropdown-link.select-category');

  checkboxLinks.forEach((checkboxLink, index) => {
      const input = checkboxLink.querySelector('input[type="checkbox"]');
      const label = checkboxLink.querySelector('.bal-checkbox-label');
      
      if (input && label) {
      const thirdPartyName = label.textContent.trim();
      
      // Update the input's data-name attribute to match the actual name
        input.dataset.name = thirdPartyName;

      // Remove any existing event listeners by cloning the element
      const newCheckboxLink = checkboxLink.cloneNode(true);
      checkboxLink.parentNode.replaceChild(newCheckboxLink, checkboxLink);
      
      // Get the new elements after cloning
      const newInput = newCheckboxLink.querySelector('input[type="checkbox"]');
      const newLabel = newCheckboxLink.querySelector('.bal-checkbox-label');
      
      // Add click event listener
      newCheckboxLink.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Toggle the checkbox
        newInput.checked = !newInput.checked;
        
        // Let handleMobileCheckboxSelection handle all visual updates
        handleMobileCheckboxSelection('thirdparty', thirdPartyName, newInput);
      });
      
    } else {

    }
  });

}

function populateThirdPartyModal(container, thirdParties) {

  // Clear all existing checkboxes
  const existingItems = container.querySelectorAll('.bal-dropdown-link.select-category');

  existingItems.forEach(item => item.remove());
  
  // Filter out unwanted values: "N/A", null, undefined, empty strings, and whitespace-only strings
  const validThirdParties = thirdParties.filter(thirdParty => {
    if (!thirdParty) return false; // null, undefined, empty string
    const trimmed = thirdParty.trim();
    if (!trimmed) return false; // whitespace-only strings
    if (trimmed.toLowerCase() === 'n/a') return false; // "N/A" values
    return true;
  });

  // Add only valid third parties from database (no "Select All" option - we have the toggle for that)
  validThirdParties.forEach((thirdParty, index) => {
    const checkboxItem = createThirdPartyCheckbox(thirdParty, index + 1, false);
    container.appendChild(checkboxItem);

  });

}

function createThirdPartyCheckbox(thirdPartyName, index, isSelectAll) {
  // Create the main container
  const checkboxLink = document.createElement('div');
  checkboxLink.className = 'bal-dropdown-link select-category';
  
  // Create the label
  const label = document.createElement('label');
  label.className = 'w-checkbox bal-checkbox-field check-list by-thirdparty';
  
  // Create the actual input
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.name = `Checkbox-ThirdParty-${index}`;
  input.id = `Checkbox-ThirdParty-${index}`;
  input.dataset.name = thirdPartyName;
  input.style.opacity = '0';
  input.style.position = 'absolute';
  input.style.zIndex = '-1';
  
  // Create the Webflow custom checkbox
  const customCheckbox = document.createElement('div');
  customCheckbox.className = 'w-checkbox-input w-checkbox-input--inputType-custom bal-checkbox';
  
  // Create the label span
  const labelSpan = document.createElement('span');
  labelSpan.className = 'bal-checkbox-label w-form-label';
  labelSpan.setAttribute('for', `Checkbox-ThirdParty-${index}`);
  labelSpan.textContent = thirdPartyName;
  
  // Assemble the elements
  label.appendChild(input);
  label.appendChild(customCheckbox);
  label.appendChild(labelSpan);
  checkboxLink.appendChild(label);
  
  // Add click event listener
        checkboxLink.addEventListener('click', (e) => {
          e.preventDefault();
    e.stopPropagation();
    
    // Toggle the checkbox
          input.checked = !input.checked;
    
    // Let handleMobileCheckboxSelection handle all visual updates
          handleMobileCheckboxSelection('thirdparty', thirdPartyName, input);
        });
  
  return checkboxLink;
  }
  
  function setupModalFooterButtons() {

    // Find all modals with data-id attributes
    const modals = document.querySelectorAll('[data-id]');

    modals.forEach(modal => {
      const modalId = modal.getAttribute('data-id');
      const footer = modal.querySelector('.filter-footer');

      if (footer) {
        // Find ALL buttons in the footer, not just specific classes
        const allButtons = footer.querySelectorAll('button, a.w-button, .btn-clear, .filter-submit');
        const clearButtons = footer.querySelectorAll('.btn-clear');
        const applyButtons = footer.querySelectorAll('.filter-submit:not(.btn-clear)');

        // Set up event listeners for all clear buttons
        clearButtons.forEach((clearButton, index) => {
        
          clearButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          
            handleModalClearAll(modalId);
          });
        });
        
        // Set up event listeners for all apply buttons
        applyButtons.forEach((applyButton, index) => {
        
          applyButton.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
          
            handleModalApply(modalId);
          });
        });
        
        // Also set up listeners based on button text content (fallback)
        allButtons.forEach((button, index) => {
          const buttonText = button.textContent.trim().toLowerCase();
          const isAlreadyClearButton = Array.from(clearButtons).includes(button);
          const isAlreadyApplyButton = Array.from(applyButtons).includes(button);
          
          if (buttonText.includes('clear') && !isAlreadyClearButton) {
          
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
            
              handleModalClearAll(modalId);
            });
          } else if (buttonText.includes('apply') && !isAlreadyApplyButton) {
          
            button.addEventListener('click', (e) => {
              e.preventDefault();
              e.stopPropagation();
            
              handleModalApply(modalId);
            });
          }
        });

      }
      
      // Set up back button and close button
      const backButton = modal.querySelector('.back-to-main');
      const closeButton = modal.querySelector('.close-category');
      
      if (backButton) {
      
        backButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        
          closeFilterModal(modalId);
        });
      }
      
      if (closeButton) {
      
        closeButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        
          closeFilterModal(modalId);
        });
      }
    });
  }
  
  function handleModalClearAll(modalId) {

  // CLEAR ALL FILTERS (except FAWRI toggle)

  // Clear all filter states

        state.selectedGroups.clear();
        updateMobileCheckboxStates('group');

        state.selectedCategories.clear();
        updateMobileCheckboxStates('category');

        state.selectedCodes.clear();
        updateMobileCheckboxStates('code');

        state.selectedThirdParties.clear();
        updateMobileCheckboxStates('thirdparty');
  
  // Reset third party toggle
  if (dom.thirdPartyToggle) {
    dom.thirdPartyToggle.checked = false;
    state.thirdPartyApproval = false;
  }

  state.selectedApprovalStages.clear();
  clearApprovalStageCheckboxes();

  state.selectedRiskRatings.clear();
  clearRiskRatingCheckboxes();
  
  // Clear desktop category/group selections too
  state.currentCategory = '';
  state.currentGroup = '';
  
 

    // Update display and apply filters
    updateMobileSortingDisplay();
    applyMobileFilters();
    
    // Find the main modal container and close both sub and main
    const subModal = document.querySelector(`[data-id="${modalId}"]`);
    const mainModal = subModal ? subModal.closest('.bal-category-modal') : null;
    
    if (mainModal) {
      // Use the new modal management system to close both sub and main modals
      closeEntireModalFromId(mainModal);
    } else {
      // Fallback to old method if main modal not found
      closeFilterModal(modalId);
    }
  }
  
  // Version of handleModalClearAll that doesn't close the modal (for use with modal management system)
  function handleModalClearAllWithoutClosing(modalId) {
    // CLEAR ALL FILTERS (except FAWRI toggle)
    
    // Clear all filter states
    state.selectedGroups.clear();
    updateMobileCheckboxStates('group');
    
    state.selectedCategories.clear();
    updateMobileCheckboxStates('category');
    
    state.selectedCodes.clear();
    updateMobileCheckboxStates('code');
    
    state.selectedThirdParties.clear();
    updateMobileCheckboxStates('thirdparty');
    
    // Reset third party toggle
    if (dom.thirdPartyToggle) {
      dom.thirdPartyToggle.checked = false;
      state.thirdPartyApproval = false;
    }
    
    state.selectedApprovalStages.clear();
    clearApprovalStageCheckboxes();
    
    state.selectedRiskRatings.clear();
    clearRiskRatingCheckboxes();
    
    // Clear desktop category/group selections too
    state.currentCategory = '';
    state.currentGroup = '';
    
    // Update display and apply filters
    updateMobileSortingDisplay();
    applyMobileFilters();
  }
  
  function handleModalApply(modalId) {
    // Apply filters with mobile optimization
    if (isMobileView()) {
      debouncedApplyMobileFilters();
    } else {
      applyMobileFilters();
    }
    
    // Optimized modal closing for better performance
    requestAnimationFrame(() => {
      const subModal = document.querySelector(`[data-id="${modalId}"]`);
      const mainModal = subModal ? subModal.closest('.bal-category-modal') : null;
      
      if (mainModal) {
        // Use the new modal management system to close both sub and main modals
        closeEntireModalFromId(mainModal);
      } else {
        // Fallback to old method if main modal not found
        closeFilterModal(modalId);
      }
    });
  }
  
  // Helper function to close entire modal (accessible from outside setupModalManagement)
  function closeEntireModalFromId(mainModal) {
    // Close all sub modals first
    const allSubModals = mainModal.querySelectorAll('.filter-group-slide');
    allSubModals.forEach(sub => {
      sub.classList.remove('is-open');
      sub.classList.add('is-closed');
      // DON'T set permanent inline styles - let CSS handle visibility
    });
    
    // Close main modal
    mainModal.classList.remove('is-open');
    mainModal.classList.add('is-closed');
    // DON'T set permanent inline styles - let CSS handle visibility
    
    // Update mobile sorting display after closing
    updateMobileSortingDisplay();
  }
  
  function closeFilterModal(modalId) {

    // Find the modal element by data-id
    const modal = document.querySelector(`[data-id="${modalId}"]`);
    
    if (modal) {

      // Try multiple approaches to close the modal
      
      // 1. Remove the is-open class
      modal.classList.remove('is-open');
      
      // 2. Add the is-closed class
      modal.classList.add('is-closed');
      
      // 3. Set display to none
      modal.style.display = 'none';
      
      // 4. Set visibility to hidden
      modal.style.visibility = 'hidden';
      
      // 5. Set opacity to 0
      modal.style.opacity = '0';
      
      // 6. Try to find and click any close button
      const closeButton = modal.querySelector('.close-category, .modal-close, [aria-label="Close"]');
      if (closeButton) {
      
        closeButton.click();
      }
      
      // 7. Try to find and click any back button
      const backButton = modal.querySelector('.back-to-main');
      if (backButton) {
      
        backButton.click();
      }
      
      // 8. Try to trigger a custom event that Webflow might be listening for
      modal.dispatchEvent(new CustomEvent('closeModal', { bubbles: true }));

      // Optional: Add a small delay before showing the main filter interface
      setTimeout(() => {
        // Force hide again after a delay
        modal.style.display = 'none';
        modal.style.visibility = 'hidden';
        modal.style.opacity = '0';
      
      }, 100);
    } else {

    }
  }
  
  function setupModalButtonDelegation() {

  // CRITICAL: Add this event listener with capture=true to catch events BEFORE other handlers
    document.addEventListener('click', (e) => {
    // Check if clicked element is a clear button FIRST
    if (e.target.matches('.btn-clear') || e.target.closest('.btn-clear')) {

      e.preventDefault();
      e.stopPropagation();
      
      const button = e.target.matches('.btn-clear') ? e.target : e.target.closest('.btn-clear');
      

      let parent = button.parentElement;
      let level = 1;
      while (parent && level <= 8) {

        parent = parent.parentElement;
        level++;
      }
      
      // Try multiple ways to find the modal
      let modal = button.closest('[data-id]');
      let modalId = null;
      
      if (!modal) {
        // Try finding modal by looking for common modal classes
        modal = button.closest('.filter-slide-wrap, .filter-group-slide, .filter-categories-slide, .filter-code-slide');
      }
      if (!modal) {
        // Try finding Webflow modal classes
        modal = button.closest('.bal-category-modal, .bal-group-modal, .bal-code-modal, .bal-third-party-modal');
      }
      if (!modal) {
        // Try finding any parent with filter-related or modal classes
        modal = button.closest('[class*="filter-"], [class*="modal"], .bal-category, .bal-group, .bal-code');
      }

      if (modal) {
        modalId = modal.getAttribute('data-id');
        
        // If no data-id, try to infer from class names
        if (!modalId) {
          const classList = Array.from(modal.classList);

          // Try to determine modal type from classes - be more specific
          if (classList.some(c => c.includes('group'))) {
            modalId = 'group';
          } else if (classList.some(c => c.includes('categor') || c.includes('category'))) {
            modalId = 'categories';
          } else if (classList.some(c => c.includes('code'))) {
            modalId = 'code';
          } else if (classList.some(c => c.includes('third'))) {
            modalId = 'thirdparty';
          }

        }
        
        if (modalId) {

          handleModalClearAll(modalId);
        } else {

        }
      } else {

      }
      return false; // Stop all further processing
    }
  }, true); // USE CAPTURE PHASE to catch events before other handlers
  
  // SECONDARY: Test if ANY document clicks are being detected
  document.addEventListener('click', (e) => {
    // Only log if it's a button or link to reduce noise
    if (e.target.tagName === 'A' || e.target.tagName === 'BUTTON' || e.target.closest('a, button')) {


    }
    
      // Check if clicked element is a clear button
      if (e.target.matches('.btn-clear') || e.target.closest('.btn-clear')) {

        e.preventDefault();
        e.stopPropagation();
        
        const button = e.target.matches('.btn-clear') ? e.target : e.target.closest('.btn-clear');
        const modal = button.closest('[data-id]');

        if (modal) {
          const modalId = modal.getAttribute('data-id');

          handleModalClearAll(modalId);
      } else {

        }
        return;
      }
      
      // Check if clicked element is an apply button
      if (e.target.matches('.filter-submit:not(.btn-clear)') || e.target.closest('.filter-submit:not(.btn-clear)')) {
        e.preventDefault();
        e.stopPropagation();
        
        const button = e.target.matches('.filter-submit:not(.btn-clear)') ? e.target : e.target.closest('.filter-submit:not(.btn-clear)');
        const modal = button.closest('[data-id]');
        
        if (modal) {
          const modalId = modal.getAttribute('data-id');
        
          handleModalApply(modalId);
        }
        return;
      }
      
      // Check if clicked element is a back button
      if (e.target.matches('.back-to-main') || e.target.closest('.back-to-main')) {
        e.preventDefault();
        e.stopPropagation();
        
        const button = e.target.matches('.back-to-main') ? e.target : e.target.closest('.back-to-main');
        const modal = button.closest('[data-id]');
        
        if (modal) {
          const modalId = modal.getAttribute('data-id');
        
          closeFilterModal(modalId);
        }
        return;
      }
      
      // Check if clicked element is a close button
      if (e.target.matches('.close-category') || e.target.closest('.close-category')) {
        e.preventDefault();
        e.stopPropagation();
        
        const button = e.target.matches('.close-category') ? e.target : e.target.closest('.close-category');
        const modal = button.closest('[data-id]');
        
        if (modal) {
          const modalId = modal.getAttribute('data-id');
        
          closeFilterModal(modalId);
        }
        return;
      }
    });

  }
  
  function preventModalFormSubmissions() {

    // DIRECT APPROACH: Find all filter footers and attach listeners to their buttons
    const filterFooters = document.querySelectorAll('.filter-footer');

    filterFooters.forEach((footer, index) => {

      // Find all buttons in this footer
      const allButtons = footer.querySelectorAll('a.w-button, a.filter-submit, button');

      // Set up listeners for each button
      allButtons.forEach((button, btnIndex) => {
        const buttonText = button.textContent.trim();
        const buttonClasses = button.className;

        // Attach click listener
        button.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();

          // Find the modal this button belongs to
          const modal = button.closest('[data-id]');
          if (modal) {
            const modalId = modal.getAttribute('data-id');
            
            // Handle based on button text
            if (buttonText.toLowerCase().includes('clear')) {

              // DIRECT APPROACH: Clear all checkboxes in this modal
              const checkboxItems = modal.querySelectorAll('.bal-dropdown-link.select-category');

              checkboxItems.forEach((item, idx) => {
                const input = item.querySelector('input[type="checkbox"]');
                const customCb = item.querySelector('.w-checkbox-input');
                
                if (input) {
                
                  input.checked = false;
                  if (customCb) {
                    customCb.classList.remove('w--redirected-checked');
                  }
                }
              });
              
              // Clear the state
              if (modalId === 'group') {
                state.selectedGroups.clear();
              } else if (modalId === 'categories' || modalId === 'category') {
                state.selectedCategories.clear();
              } else if (modalId === 'code') {
                state.selectedCodes.clear();
              } else if (modalId === 'thirdparty') {
                state.selectedThirdParties.clear();
              }
              
              // Update display and close modal
              updateMobileSortingDisplay();
              applyMobileFilters();
              closeFilterModal(modalId);
              
            } else if (buttonText.toLowerCase().includes('apply')) {

              // Just close the modal - filters are already applied when checkboxes are clicked
              closeFilterModal(modalId);
            }
          }
          
          return false;
        });
      });
    });
    
    // Also handle forms (as a backup)
    const modalForms = document.querySelectorAll('[data-id] form');

    modalForms.forEach((form, index) => {

      form.addEventListener('submit', (e) => {
      
        e.preventDefault();
        e.stopPropagation();
        return false;
      });
    });
    
    // Also prevent any button clicks inside modal forms from submitting
    document.addEventListener('click', (e) => {
      // Handle back and close buttons (not inside forms)
      if (e.target.matches('.back-to-main') || e.target.closest('.back-to-main')) {
        const modal = e.target.closest('[data-id]');
        if (modal) {
          e.preventDefault();
          e.stopPropagation();
          const modalId = modal.getAttribute('data-id');
        
          closeFilterModal(modalId);
          return false;
        }
      }
      
      if (e.target.matches('.close-category') || e.target.closest('.close-category')) {
        const modal = e.target.closest('[data-id]');
        if (modal) {
          e.preventDefault();
          e.stopPropagation();
          const modalId = modal.getAttribute('data-id');
        
          closeFilterModal(modalId);
          return false;
        }
      }
      
      const button = e.target.closest('button, input[type="submit"], .btn-clear, .filter-submit');
      if (button) {
        const modalForm = button.closest('[data-id] form');
        if (modalForm) {
        
          e.preventDefault();
          e.stopPropagation();
          
          // Handle our custom buttons with detailed logging
          const modal = button.closest('[data-id]');
          if (modal) {
            const modalId = modal.getAttribute('data-id');
            const buttonText = button.textContent.trim();
            const buttonClasses = button.className;

            if (button.matches('.btn-clear') || buttonText.toLowerCase().includes('clear')) {
            
              handleModalClearAll(modalId);
            } else if (button.matches('.filter-submit:not(.btn-clear)') || buttonText.toLowerCase().includes('apply')) {
            
              handleModalApply(modalId);
            } else {
            
            }
          }
          
          return false;
        }
      }
    });

  }
  
  function setupMobileSortingTabs() {

    // Update tab display text based on current state
    updateMobileSortingDisplay();
    
    // Set up modal click handlers - these will open the existing filter slide modals
    // The modals are already populated with database data and have click handlers
  
  // Set up filter tab click handlers for data-modal elements
  setupFilterTabClickHandlers();
    
    // Set up tab switching
    if (dom.mobileGroupTab) {
      dom.mobileGroupTab.addEventListener('click', () => {
      
        // Reset other filters when switching tabs
        state.currentCategory = '';
        updateMobileSortingDisplay();
      });
    }
    
    if (dom.mobileCategoriesTab) {
      dom.mobileCategoriesTab.addEventListener('click', () => {
      
        // Reset other filters when switching tabs
        state.currentGroup = '';
        updateMobileSortingDisplay();
      });
    }
    
    if (dom.mobileCodeTab) {
      dom.mobileCodeTab.addEventListener('click', () => {
      
        // This is for sorting, not filtering
        updateMobileSortingDisplay();
      });
    }
  }

function setupFilterTabClickHandlers() {
  // Set up click handlers for all filter tab elements with data-modal attributes
  const filterTabs = document.querySelectorAll('[data-modal]');
  
  filterTabs.forEach(tab => {
    const modalId = tab.getAttribute('data-modal');
    
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      openFilterModal(modalId);
    });
  });
}

function openFilterModal(modalId) {
  // Find the sub-modal element by data-id
  const subModal = document.querySelector(`[data-id="${modalId}"]`);
  
  if (subModal) {
    // Find the main modal container
    const mainModal = subModal.closest('.bal-category-modal');
    
    if (mainModal) {
      // First, open the main modal
      mainModal.classList.remove('is-closed');
      mainModal.classList.add('is-open');
      // Clear any inline styles that might be hiding the main modal
      mainModal.style.display = '';
      mainModal.style.visibility = '';
      mainModal.style.opacity = '';
      
      // Then open the specific sub-modal
      // Close any other open sub-modals first
      const allSubModals = mainModal.querySelectorAll('.filter-group-slide');
      allSubModals.forEach(sub => {
        sub.classList.remove('is-open');
        sub.classList.add('is-closed');
        // DON'T set permanent inline styles - let CSS handle it
      });
      
      // Open the requested sub-modal
      subModal.classList.remove('is-closed');
      subModal.classList.add('is-open');
      subModal.style.display = '';
      subModal.style.visibility = '';
      subModal.style.opacity = '';
      
      // Also try to trigger any Webflow interactions
      const overlay = subModal.querySelector('.filter-slide-overlay');
      if (overlay) {
        overlay.style.display = '';
        overlay.style.opacity = '';
      }
    } else {
      // Fallback: old method if no main modal container found
      subModal.classList.remove('is-closed');
      subModal.classList.add('is-open');
      subModal.style.display = '';
      subModal.style.visibility = '';
      subModal.style.opacity = '';
      
      const overlay = subModal.querySelector('.filter-slide-overlay');
      if (overlay) {
        overlay.style.display = '';
        overlay.style.opacity = '';
      }
    }
  }
}
  
  // Cache DOM elements for better performance
  let cachedMobileElements = null;
  let lastMobileState = null;

  function initializeMobileDisplayCache() {
    if (!cachedMobileElements) {
      cachedMobileElements = {
        groupTab: document.querySelector('[data-modal="group"]'),
        categoriesTab: document.querySelector('[data-modal="categories"]'),
        codeTab: document.querySelector('[data-modal="code"]'),
        thirdPartyTab: document.querySelector('[data-modal="thirdparty"]')
      };
      
      // Cache the select elements too
      if (cachedMobileElements.groupTab) {
        cachedMobileElements.groupSelect = cachedMobileElements.groupTab.querySelector('.filter-tab-click-select');
      }
      if (cachedMobileElements.categoriesTab) {
        cachedMobileElements.categorySelect = cachedMobileElements.categoriesTab.querySelector('.filter-tab-click-select');
      }
      if (cachedMobileElements.codeTab) {
        cachedMobileElements.codeSelect = cachedMobileElements.codeTab.querySelector('.filter-tab-click-select');
      }
      if (cachedMobileElements.thirdPartyTab) {
        cachedMobileElements.thirdPartySelect = cachedMobileElements.thirdPartyTab.querySelector('.filter-tab-click-select');
      }
    }
  }

  function updateMobileSortingDisplay() {
    // Skip updates if not in mobile view to improve desktop performance
    if (!isMobileView()) return;

    initializeMobileDisplayCache();

    // Create current state snapshot for comparison
    const currentState = {
      groupCount: state.selectedGroups.size,
      categoryCount: state.selectedCategories.size,
      codeCount: state.selectedCodes.size,
      thirdPartyCount: state.selectedThirdParties.size
    };

    // Skip update if state hasn't changed
    if (lastMobileState && 
        currentState.groupCount === lastMobileState.groupCount &&
        currentState.categoryCount === lastMobileState.categoryCount &&
        currentState.codeCount === lastMobileState.codeCount &&
        currentState.thirdPartyCount === lastMobileState.thirdPartyCount) {
      return;
    }

    // Update Group tab
    if (cachedMobileElements.groupSelect) {
      const groupCount = currentState.groupCount;
      if (groupCount > 0) {
        const selectedItems = Array.from(state.selectedGroups);
        cachedMobileElements.groupSelect.textContent = groupCount === 1 ? 
          selectedItems[0] : `${groupCount} Groups`;
      } else {
        cachedMobileElements.groupSelect.textContent = 'All Groups';
      }
    }
    
    // Update Categories tab
    if (cachedMobileElements.categorySelect) {
      const categoryCount = currentState.categoryCount;
      if (categoryCount > 0) {
        const selectedItems = Array.from(state.selectedCategories);
        cachedMobileElements.categorySelect.textContent = categoryCount === 1 ? 
          selectedItems[0] : `${categoryCount} Categories`;
      } else {
        cachedMobileElements.categorySelect.textContent = 'All Categories';
      }
    }
    
    // Update Code tab
    if (cachedMobileElements.codeSelect) {
      const codeCount = currentState.codeCount;
      if (codeCount > 0) {
        const selectedItems = Array.from(state.selectedCodes);
        cachedMobileElements.codeSelect.textContent = codeCount === 1 ? 
          selectedItems[0] : `${codeCount} Codes`;
      } else {
        cachedMobileElements.codeSelect.textContent = 'All Activities';
      }
    }
    
    // Update Third Party tab
    if (cachedMobileElements.thirdPartySelect) {
      const thirdPartyCount = currentState.thirdPartyCount;
      if (thirdPartyCount > 0) {
        const selectedItems = Array.from(state.selectedThirdParties);
        if (thirdPartyCount === 1) {
          const item = selectedItems[0];
          cachedMobileElements.thirdPartySelect.textContent = item.length > 20 ? 
            item.substring(0, 17) + '...' : item;
        } else {
          cachedMobileElements.thirdPartySelect.textContent = `${thirdPartyCount} Selected`;
        }
      } else {
        cachedMobileElements.thirdPartySelect.textContent = 'None Required';
      }
    }

    // Update last state
    lastMobileState = currentState;
  }
  
  // Debounced versions of update functions for better performance
  const debouncedUpdateMobileDisplay = debounce(updateMobileSortingDisplay, 100);
  const debouncedApplyMobileFilters = debounce(applyMobileFilters, 200);

  function handleMobileCheckboxSelection(type, item, checkbox) {
    // Early return if mobile performance is critical and we're on desktop
    if (!isMobileView()) {
      return handleDesktopCheckboxSelection(type, item, checkbox);
    }

    // Check which container this checkbox belongs to
    const container = checkbox.closest('.bal-dropdown-checkbox-wrap.select-listing');
    const modal = checkbox.closest('[data-id]');
    const modalId = modal?.getAttribute('data-id');

    // Check if the type matches the modal
    if (modalId && modalId !== type) {
      type = modalId; // Fix the type based on the actual modal
    }
      
    // Get the current state of the checkbox
    const isChecked = checkbox.checked;
    const customCheckbox = checkbox.closest('label')?.querySelector('.w-checkbox-input');

    // Note: "Select All" functionality removed - no longer needed
    
    // Handle individual item selection (multi-select)
    const selectedSet = getSelectedSetByType(type);
    
    // IMPORTANT: Ensure visual and input states are synchronized
    if (customCheckbox) {
      if (isChecked) {
        customCheckbox.classList.add('w--redirected-checked');
      } else {
        customCheckbox.classList.remove('w--redirected-checked');
      }
    }
    
    if (isChecked) {
      // Add to selection
      selectedSet.add(item);
    } else {
      // Remove from selection
      selectedSet.delete(item);
    }

    // Use debounced updates for better performance
    debouncedUpdateMobileDisplay();
    debouncedApplyMobileFilters();
  }

  // Separate handler for desktop to avoid mobile-specific overhead
  function handleDesktopCheckboxSelection(type, item, checkbox) {
    const isChecked = checkbox.checked;
    const selectedSet = getSelectedSetByType(type);
    
    if (isChecked) {
      selectedSet.add(item);
    } else {
      selectedSet.delete(item);
    }
    
    // Desktop can handle immediate updates
    updateMobileSortingDisplay();
    applyMobileFilters();
  }
  
  function getContainerByType(type) {
    let container;
    switch (type) {
      case 'group': 
        container = dom.mobileGroupCheckboxContainer;
        break;
      case 'category': 
    case 'categories': // Handle both singular and plural
        container = dom.mobileCategoriesCheckboxContainer;
        break;
      case 'code': 
        container = dom.mobileCodeCheckboxContainer;
        break;
      case 'thirdparty': 
        container = dom.mobileThirdPartyCheckboxContainer;
        break;
      default: 
        container = null;
    }

    return container;
  }
  
  function getSelectedSetByType(type) {

    switch (type) {
    case 'group': 

      return state.selectedGroups;
    case 'category':
    case 'categories': // Handle both singular and plural

      return state.selectedCategories;
    case 'code': 

      return state.selectedCodes;
    case 'thirdparty': 

      return state.selectedThirdParties;
    default: 

      return new Set();
    }
  }
  
  function uncheckSelectAll(type) {
    const container = getContainerByType(type);
    if (!container) return;
    
    const selectAllCheckbox = container.querySelector('input[type="checkbox"]');
    if (selectAllCheckbox) {
      selectAllCheckbox.checked = false;
    }
  }
  
  function applyMobileFilters() {

    // Reset to first page and reload data
    state.currentPage = 1;
    renderPage(1);
  }
  
  function updateMobileCheckboxStates(type) {

    const container = getContainerByType(type);

    if (!container) {

      return;
    }
    
    const selectedSet = getSelectedSetByType(type);

    // Find all checkbox items (not just the input elements)
    const allCheckboxItems = container.querySelectorAll('.bal-dropdown-link.select-category');

    // Clear all checkboxes (Webflow specific)
    allCheckboxItems.forEach((checkboxItem, index) => {
      const input = checkboxItem.querySelector('input[type="checkbox"]');
      const customCheckbox = checkboxItem.querySelector('.w-checkbox-input');
      const itemName = input?.dataset?.name;
      
      // Log what we found

      if (!input || !customCheckbox) {

        return;
      }
      
      const wasChecked = input.checked;
      const wasWebflowChecked = customCheckbox.classList.contains('w--redirected-checked');
      
      let shouldBeChecked = false;
      
      // Determine if this checkbox should be checked
    // Check individual item if it's in the selected set (no "Select All" logic needed)
        shouldBeChecked = selectedSet.has(itemName);
      
      // Update the actual checkbox
      input.checked = shouldBeChecked;
      
      // Update Webflow's custom checkbox styling
      if (shouldBeChecked) {
        customCheckbox.classList.add('w--redirected-checked');
      } else {
        customCheckbox.classList.remove('w--redirected-checked');
      }

    });

  }
  
  function handleMobileSortingSelection(type, selectedItem) {

    switch (type) {
      case 'group':
        const newGroup = selectedItem === 'All Groups' ? '' : selectedItem;
        handleGroupChange(newGroup);
        break;
        
      case 'categories':
        const newCategory = selectedItem === 'All Categories' ? '' : selectedItem;
        handleCategoryChange(newCategory);
        break;
        
      case 'code':
        // Handle code sorting (ascending/descending)
        handleCodeSorting(selectedItem);
        break;
    }
    
    // Update the display
    updateMobileSortingDisplay();
  }
  
  function handleCodeSorting(sortOrder) {
  
    // Store sort order in state
    state.codeSortOrder = sortOrder.toLowerCase();
    
    // Re-render with new sort order
    state.currentPage = 1;
    renderPage(1);
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
        return [];
      }
      
      // Extract unique groups and sort them
      const groups = Array.from(new Set(data.map(item => item['Group']))).filter(Boolean).sort();
      
      // Debug the data structure
("First few group items:", data.slice(0, 3));
(`Found ${groups.length} unique groups:`, groups);
      
      return groups;
    } catch (error) {
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
        // 
      }
      
      // Fetch all unique categories and groups from the database
      const { data, error } = await supabase.from('Activity List').select('Category, Group');
      if (error) {
        // 
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
      // 
    }
  }

  function populateCategoryTabs(categories, groups) {
    // Find the category container
    const categoryContainer = document.querySelector('.bal-category-lists:nth-child(1)');
    
    if (!categoryContainer) {
      // 
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
      // 
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

    state.currentCategory = newCategory;
    state.currentGroup = ''; // Reset group when changing category
    
    updateActiveCategoryClass();
    updateMobileSortingDisplay(); // Update mobile display
    
    // Reset to first page and reload data
    state.currentPage = 1;
    renderPage(1);
  }
  
  function handleGroupChange(newGroup) {
    if (state.currentGroup === newGroup) return;

    state.currentGroup = newGroup;
    state.currentCategory = ''; // Reset category when changing group
    
    updateActiveCategoryClass();
    updateMobileSortingDisplay(); // Update mobile display
    
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
    const { currentCategory, currentGroup, searchTerm, columnFilters, thirdPartyApproval, selectedThirdParties, selectedGroups, selectedCategories, selectedCodes, selectedApprovalStages, selectedRiskRatings, fawriMode } = state;

    const cacheKey = `${currentCategory}|${currentGroup}|${searchTerm}|${columnFilters}|${thirdPartyApproval}|${Array.from(selectedThirdParties).join(',')}|${Array.from(selectedGroups).join(',')}|${Array.from(selectedCategories).join(',')}|${Array.from(selectedCodes).join(',')}|${Array.from(selectedApprovalStages).join(',')}|${Array.from(selectedRiskRatings).join(',')}|${fawriMode}|${page}`;
("Cache key:", cacheKey);
    
    const cachedResult = cache.get(cacheKey);
    if (cachedResult) {
("Using cached data:", cachedResult);
      // Clean N/A values from cached data as well
      const cleanedCachedData = cachedResult.data.map(item => {
        const cleanedItem = { ...item };
        // Clean N/A values from all fields
        Object.keys(cleanedItem).forEach(key => {
          if (cleanedItem[key] === 'N/A' || cleanedItem[key] === 'n/a') {
            cleanedItem[key] = '';
          }
        });
        return cleanedItem;
      });
      renderResults(cleanedCachedData, page, cachedResult.count, append);
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
    
    // Apply FAWRI mode filter (Low and Medium risk activities only)
    if (fawriMode) {
    
      query = query.in('Risk Rating', ['Low', 'Medium']);
    }
    
    // Apply third party approval filter if enabled
    if (thirdPartyApproval) {

      query = query.not('Third Party', 'is', null);
    }
    
    // Apply specific third party filters if any are selected
    if (selectedThirdParties.size > 0) {

      query = query.in('Third Party', Array.from(selectedThirdParties));
    }
    
    // Apply mobile multi-select filters
    if (selectedGroups.size > 0) {
    
      query = query.in('Group', Array.from(selectedGroups));
    }
    
    if (selectedCategories.size > 0) {
    
      query = query.in('Category', Array.from(selectedCategories));
    }
    
    if (selectedCodes.size > 0) {
    
      query = query.in('Code', Array.from(selectedCodes));
    }
  
  // Apply approval stage filters if any are selected
  if (selectedApprovalStages.size > 0) {

    // Convert UI values to API values and handle null case
    const apiValues = Array.from(selectedApprovalStages).map(stage => {
      switch (stage) {
        case 'Pre-approval': return 'PRE';
        case 'Post-approval': return 'POST';
        case 'N/A': return null;
        default: return stage;
      }
    });
    
    // Handle null values separately since Supabase needs special handling for null
    const nonNullValues = apiValues.filter(val => val !== null);
    const hasNullValue = apiValues.includes(null);
    
    if (nonNullValues.length > 0 && hasNullValue) {
      // Include both non-null values and null values
      query = query.or(`When.in.(${nonNullValues.join(',')}),When.is.null`);
    } else if (nonNullValues.length > 0) {
      // Only non-null values
      query = query.in('When', nonNullValues);
    } else if (hasNullValue) {
      // Only null values
      query = query.is('When', null);
    }
  }
  
  // Apply risk rating filters if any are selected
  if (selectedRiskRatings.size > 0) {

    // Convert UI values to API values
    const apiValues = Array.from(selectedRiskRatings).map(rating => {
      switch (rating) {
        case 'High-override': return 'Override';
        default: return rating; // Low, Medium, High stay the same
      }
    });

    query = query.in('Risk Rating', apiValues);
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
            // 
          }
        } else if (filter.includes(',')) {
          // OR condition
    (`Adding OR filter: ${filter}`);
          try {
          query = query.or(filter);
      ("OR filter applied successfully");
          } catch (orError) {
            // 
          }
        } else {
          // 
        }
      });
    }

    const from = (page - 1) * PER_PAGE;
    const to = from + PER_PAGE - 1;
    
    // Apply sorting based on mobile sorting state
    const isAscending = !state.codeSortOrder || state.codeSortOrder === 'ascending';
    query = query.order('Code', { ascending: isAscending }).range(from, to);
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
        // 
      hideLoader();
        hideBottomLoader();
        return; // Exit early on error
      } else {
        // Continue with the data we have
        if (data && data.length > 0) {
          // Clean N/A values from the data before rendering
          const cleanedData = data.map(item => {
            const cleanedItem = { ...item };
            // Clean N/A values from all fields
            Object.keys(cleanedItem).forEach(key => {
              if (cleanedItem[key] === 'N/A' || cleanedItem[key] === 'n/a') {
                cleanedItem[key] = '';
              }
            });
            return cleanedItem;
          });
          
          // Cache the cleaned result
          cache.set(cacheKey, cleanedData, count);
          // Render the results
          renderResults(cleanedData, page, count, append);
        } else {
    ("No data returned from query");
          renderResults([], page, 0, append);
        }
        return;
      }
    } catch (queryError) {
      // 
      // 
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
        
        // Clean N/A values from the data before rendering
        const cleanedData = data.map(item => {
          const cleanedItem = { ...item };
          // Clean N/A values from all fields
          Object.keys(cleanedItem).forEach(key => {
            if (cleanedItem[key] === 'N/A' || cleanedItem[key] === 'n/a') {
              cleanedItem[key] = '';
            }
          });
          return cleanedItem;
        });
        
        cache.set(cacheKey, cleanedData, count);
        renderResults(cleanedData, page, count, append);
      } else {
        cache.set(cacheKey, data, count);
        renderResults(data, page, count, append);
    }
    } catch (err) {
        // 
      // 
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
    
    if (isMobileView() && dom.mobileListEl) {
      // Mobile view - add loader to mobile container
      const loaderDiv = document.createElement('div');
      loaderDiv.className = 'bottom-loader-row';
      loaderDiv.appendChild(createLoader());
      dom.mobileListEl.appendChild(loaderDiv);
    } else if (dom.tableBodyEl) {
      // Desktop view - add loader to table
    const loaderRow = document.createElement('tr');
    loaderRow.className = 'table_row bottom-loader-row';
    const loaderCell = document.createElement('td');
    loaderCell.colSpan = 9; // Adjusted for all columns
    loaderCell.className = 'table_cell';
    loaderCell.appendChild(createLoader());
    loaderRow.appendChild(loaderCell);
    
    // Append to the table body
      dom.tableBodyEl.appendChild(loaderRow);
    }
  }
  
  // Hide the bottom loader
  function hideBottomLoader() {
    if (isMobileView() && dom.mobileListEl) {
      // Mobile view - remove bottom loader from mobile container
      const loaderRow = dom.mobileListEl.querySelector('.bottom-loader-row');
    if (loaderRow) {
      loaderRow.remove();
      }
    } else if (dom.tableBodyEl) {
      // Desktop view - remove bottom loader from table
      const loaderRow = dom.tableBodyEl.querySelector('.bottom-loader-row');
      if (loaderRow) {
        loaderRow.remove();
      }
    }
  }

  function renderResults(data, page, count, append = false) {
(`Rendering results for page ${page}, count: ${count}, append: ${append}`);
    hideLoader();
    hideBottomLoader();
    
    const isMobile = isMobileView();
    
    // Verify container elements are valid based on view type
    if (isMobile && !dom.mobileListEl) {
      return;
    } else if (!isMobile && !dom.tableBodyEl) {
      return;
    }
    
    // Only clear the container if not appending
    if (!append) {
      if (isMobile) {
        dom.mobileListEl.innerHTML = '';
      } else {
        dom.tableBodyEl.innerHTML = '';
      }
    }

    if (data?.length > 0) {
      // Mobile-specific performance optimizations
      if (isMobile) {
        renderMobileResults(data, append);
      } else {
        renderDesktopResults(data, append);
      }
    } else {
      // Handle no results case
      if (isMobile) {
        dom.mobileListEl.innerHTML = '<div class="no-results">No activities found</div>';
      } else {
        dom.tableBodyEl.innerHTML = '<tr><td colspan="100%" class="no-results">No activities found</td></tr>';
      }
    }

    // Update pagination info
    updatePaginationInfo(count, page);
  }

  // Separate mobile rendering function for better performance
  function renderMobileResults(data, append) {
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    // Batch DOM operations
    data.forEach((item, index) => {
      const mobileItem = createMobileItem(item);
      fragment.appendChild(mobileItem);
    });
    
    // Single DOM append operation
    dom.mobileListEl.appendChild(fragment);
  }

  // Separate desktop rendering function
  function renderDesktopResults(data, append) {
    // Use DocumentFragment for better performance
    const fragment = document.createDocumentFragment();
    
    data.forEach((item, index) => {
      const row = createDesktopTableRow(item);
      fragment.appendChild(row);
    });
    
    // Single DOM append operation
    dom.tableBodyEl.appendChild(fragment);
  }

  // Helper function to create desktop table row
  function createDesktopTableRow(item) {
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
    
    // Event handling now done via delegation for better performance
    
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
    
    // Event handling now done via delegation for better performance
    
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
    thirdPartyCell.textContent = item['Third Party'] || '';
    row.appendChild(thirdPartyCell);
    
    // When column
    const whenCell = document.createElement('td');
    whenCell.className = 'table_cell';
    // Convert database values to display text
    let whenText = '';
    switch (item['When']) {
      case 'PRE':
        whenText = 'Pre Approval';
        break;
      case 'POST':
        whenText = 'Post Approval';
        break;
      default:
        // If it's not PRE or POST, show the actual value
        whenText = item['When'] || '';
    }
    whenCell.textContent = whenText;
    row.appendChild(whenCell);
    
    // Notes column
    const notesCell = document.createElement('td');
    notesCell.className = 'table_cell';
    notesCell.textContent = item['Notes'] || '';
    row.appendChild(notesCell);
    
    // Risk Rating column
    const riskRatingCell = document.createElement('td');
    riskRatingCell.className = 'table_cell';
    riskRatingCell.textContent = item['Risk Rating'] || '';
    row.appendChild(riskRatingCell);
    
    // DNFBP column
    const dnfbpCell = document.createElement('td');
    dnfbpCell.className = 'table_cell';
    dnfbpCell.textContent = item['DNFBP'] || '';
    row.appendChild(dnfbpCell);
    
    // Store all item data as a data attribute for modal display
    row.dataset.activityData = JSON.stringify(item);
    
    // Store activity code for reference (used for saved items sync)
    row.dataset.activityCode = item.Code;
    
    // Add click event to show modal with activity details
    row.style.cursor = 'pointer';
    row.addEventListener('click', (event) => {
      // Ignore clicks on buttons (copy, save, etc.)
      if (event.target.closest('.btn-copy, .btn-save, button, a')) {
        return;
      }
      event.stopPropagation();
      showActivityDetailsModal(item);
    });
    
    return row;
  }

  // Helper function to update pagination info
  function updatePaginationInfo(count, page) {
    state.currentPage = page;
    // Update any pagination UI elements if needed
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
      const value = activityData[field.key] || '';
      
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

  // ─── Search Functionality ──────────────────────────────────────

  function setupSearch() {

    // Set up all search inputs (desktop and mobile)
    if (dom.searchInputs && dom.searchInputs.length > 0) {

      // Set up search-on-type with debounce for all search inputs
      const handleSearchInput = debounce((event) => {
        const searchTerm = event.target.value.trim();

        state.searchTerm = searchTerm;
        state.currentPage = 1;
        renderPage(1);
        
        // Sync the search term to all other search inputs
        dom.searchInputs.forEach(input => {
          if (input !== event.target && input.value !== searchTerm) {
            input.value = searchTerm;
          }
        });
      }, 350);
      
      // Attach event listeners to all search inputs
      dom.searchInputs.forEach((searchInput, index) => {

        // Attach search-on-type event listener
        searchInput.addEventListener('input', handleSearchInput);
        
        // Prevent form submission on Enter key and trigger search
        searchInput.addEventListener('keydown', (event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            
            // Trigger search manually on Enter
            const searchTerm = searchInput.value.trim();

          state.searchTerm = searchTerm;
          state.currentPage = 1;
          renderPage(1);
            
            // Sync to all search inputs
            dom.searchInputs.forEach(input => {
              if (input.value !== searchTerm) {
                input.value = searchTerm;
              }
            });
          }
        });
      });
    }
    
    // Set up main search form to prevent submission
    if (dom.searchForm) {

      // Prevent form submission - use capture phase to ensure it's caught early
      dom.searchForm.addEventListener('submit', (event) => {
      
        event.preventDefault();
        event.stopPropagation();
        
        // Find the search input directly within the form
        const searchInput = event.target.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');

        // Trigger search manually
        if (searchInput) {
          const searchTerm = searchInput.value.trim();

          state.searchTerm = searchTerm;
          state.currentPage = 1;
          renderPage(1);
          
          // Sync to all search inputs
          dom.searchInputs.forEach(input => {
            if (input.value !== searchTerm) {
              input.value = searchTerm;
            }
          });
        }
        
        return false; // Extra measure to prevent submission
      }, true); // Use capture phase
      
      // Also prevent default on the form itself using the onsubmit property
      dom.searchForm.onsubmit = function() {
      
        return false;
      };
    }
      
    // Set up search submit buttons
      if (dom.searchSubmitBtn) {

        // Remove any existing click listeners
        const newSubmitBtn = dom.searchSubmitBtn.cloneNode(true);
        if (dom.searchSubmitBtn.parentNode) {
          dom.searchSubmitBtn.parentNode.replaceChild(newSubmitBtn, dom.searchSubmitBtn);
        }
        dom.searchSubmitBtn = newSubmitBtn;
        
        // Add new click listener
        dom.searchSubmitBtn.addEventListener('click', (event) => {
      
          event.preventDefault();
          event.stopPropagation();
          
        // Find search input in multiple ways
          let searchInput = null;
          
        // Strategy 1: Look for input in the same container
            const searchContainer = event.target.closest('.bal-search');
            if (searchContainer) {
          searchInput = searchContainer.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
        
        }
        
        // Strategy 2: Look for input in the same form
        if (!searchInput) {
          const form = event.target.closest('form');
          if (form) {
            searchInput = form.querySelector('input[type="text"], input.bal-search-input, #search-input, input[name="searchInput"]');
          
          }
        }
        
        // Strategy 3: Use the first search input from our collection
        if (!searchInput && dom.searchInputs.length > 0) {
          searchInput = dom.searchInputs[0];
        
        }
        
        // Trigger search if we found an input
          if (searchInput) {
            const searchTerm = searchInput.value.trim();
        
            state.searchTerm = searchTerm;
            state.currentPage = 1;
            renderPage(1);
          
          // Sync to all search inputs
          dom.searchInputs.forEach(input => {
            if (input.value !== searchTerm) {
              input.value = searchTerm;
            }
          });
        } else {
        
          }
          
          return false; // Extra measure to prevent submission
        }, true); // Use capture phase
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
      // 
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
        // 
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
      // 
      return {};
    }
    
    const headerRow = tableEl.querySelector('tr');
    if (!headerRow) {
      // 
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
        // 
        
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
      // 
      return;
    }
    
(`Toggling column "${columnName}" (index ${columnIndex}) visibility: ${isVisible ? 'show' : 'hide'}`);
    
    // Apply CSS to handle column width automatically
    const styleId = `column-style-${columnIndex}`;
    let styleEl = document.getElementById(styleId);
    
    if (!styleEl && !isVisible) {
      // 
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
      // 
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
      // 
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
          'Third Party': item['Third Party'] || ''
        });
        saveSavedActivities(savedActivities);
        
        // Update saved items table
        renderSavedItems();
      }
    }
  }
  
  // Render saved items in both mobile and desktop views
  function renderSavedItems() {

    // Re-query the DOM in case it wasn't available during initialization
    if (!dom.savedTableBody) {
    
      dom.savedTableBody = document.querySelector('.bal-table-saved-tbody, #saved_list_table tbody, .bal-table-saved tbody');
    
    }
    
    // Also re-query mobile container
    if (!dom.savedMobileContainer) {
    
      dom.savedMobileContainer = document.querySelector('.bal-wrapper.for-mobile.saaved-items, .bal-wrapper.for-mobile.saved-items');
    
    }
    
    const savedActivities = getSavedActivities();

    // Clear both desktop table and mobile container
    if (dom.savedTableBody) {
    
    dom.savedTableBody.innerHTML = '';
    }
    
    if (dom.savedMobileContainer) {
    
      dom.savedMobileContainer.innerHTML = '';
    }
    
    if (savedActivities.length === 0) {
      // Show empty state for desktop
      if (dom.savedTableBody) {
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
      }
      
      // Show empty state for mobile
      if (dom.savedMobileContainer) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'no-saved-mobile';
        emptyDiv.textContent = 'No saved activities';
        emptyDiv.style.cssText = 'text-align: center; padding: 40px 20px; color: #666;';
        dom.savedMobileContainer.appendChild(emptyDiv);
      }
    } else {
      // Add each saved activity to both desktop table and mobile container
      savedActivities.forEach(item => {
        // Create desktop table row
        if (dom.savedTableBody) {
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
                // 
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
        }
        
        // Create mobile item
        if (dom.savedMobileContainer) {
          const mobileItem = createMobileSavedItem(item);
          dom.savedMobileContainer.appendChild(mobileItem);
        }
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
        // 
        return [];
      }
      
      // Extract unique third parties and sort them
      const thirdParties = Array.from(new Set(data.map(item => item['Third Party']))).filter(Boolean).sort();
      
      // Debug the data structure
("First few data items:", data.slice(0, 3));
(`Found ${thirdParties.length} unique third parties:`, thirdParties);
      
      return thirdParties;
    } catch (error) {
      // 
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
      // 
      
      // As a last resort, find the dropdown and create the structure
      const dropdown = document.querySelector('.bal-select-items-wrap');
      if (dropdown) {
  ("Found dropdown, creating container structure");
        checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'bal-dropdown-checkbox-wrap';
        dropdown.appendChild(checkboxContainer);
      } else {
          // 
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
      
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = `Checkbox-ThirdParty-${index}`;
      input.id = `Checkbox-ThirdParty-${index}`;
      input.dataset.name = thirdParty;
      input.style.opacity = '0';
      input.style.position = 'absolute';
      input.style.zIndex = '-1';
      
      const checkboxInput = document.createElement('div');
      checkboxInput.className = 'w-checkbox-input w-checkbox-input--inputType-custom bal-checkbox';
      
      const span = document.createElement('span');
      span.className = 'bal-checkbox-label w-form-label';
      span.setAttribute('for', `Checkbox-ThirdParty-${index}`);
      span.textContent = thirdParty;
      
      label.appendChild(input);
      label.appendChild(checkboxInput);
      label.appendChild(span);
      checkboxDiv.appendChild(label);
      checkboxContainer.appendChild(checkboxDiv);
    });
    
(`Added ${thirdParties.length} third party checkboxes`);
    
    // Update DOM reference to include new checkboxes
    dom.thirdPartyCheckboxes = document.querySelectorAll('.bal-dropdown-link input[type="checkbox"]');
  }

// Set up approval stage filter checkboxes
function setupApprovalStageFilter() {

  // Find the approval stage checkboxes container
  const approvalStageContainer = document.querySelector('.filter-when .bal-dropdown-checkbox-wrap');
  
  if (!approvalStageContainer) {

    return;
  }

  // Find all checkboxes in the approval stage container
  const checkboxes = approvalStageContainer.querySelectorAll('input[type="checkbox"]');

  // Set up event listeners for each checkbox
  checkboxes.forEach((checkbox, index) => {
    const label = checkbox.nextElementSibling;
    const stageName = label ? label.textContent.trim() : `Stage ${index + 1}`;

    checkbox.addEventListener('change', (event) => {

      if (event.target.checked) {
        // Add to selected approval stages
        state.selectedApprovalStages.add(stageName);

      } else {
        // Remove from selected approval stages
        state.selectedApprovalStages.delete(stageName);

      }
      
      // 
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
  });

}

function clearApprovalStageCheckboxes() {

  const approvalStageContainer = document.querySelector('.filter-when .bal-dropdown-checkbox-wrap');
  if (!approvalStageContainer) return;

  const checkboxItems = approvalStageContainer.querySelectorAll('.bal-dropdown-link.select-category');
  checkboxItems.forEach((item) => {
    const input = item.querySelector('input[type="checkbox"]');
    const customCheckbox = item.querySelector('.w-checkbox-input');
    
    if (input && customCheckbox) {
      input.checked = false;
      customCheckbox.classList.remove('w--redirected-checked');
    }
  });

}

// Set up risk rating filter checkboxes
function setupRiskRatingFilter() {

  // Find the risk rating checkboxes container
  const riskRatingContainer = document.querySelector('.filter-risk .bal-dropdown-checkbox-wrap');
  
  if (!riskRatingContainer) {

    return;
  }

  // Find all checkboxes in the risk rating container
  const checkboxes = riskRatingContainer.querySelectorAll('input[type="checkbox"]');

  // Set up event listeners for each checkbox
  checkboxes.forEach((checkbox, index) => {
    const label = checkbox.nextElementSibling;
    const ratingName = label ? label.textContent.trim() : `Rating ${index + 1}`;

    checkbox.addEventListener('change', (event) => {

      if (event.target.checked) {
        // Add to selected risk ratings
        state.selectedRiskRatings.add(ratingName);

      } else {
        // Remove from selected risk ratings
        state.selectedRiskRatings.delete(ratingName);

      }
      
      // 
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
  });

}

function clearRiskRatingCheckboxes() {

  const riskRatingContainer = document.querySelector('.filter-risk .bal-dropdown-checkbox-wrap');
  if (!riskRatingContainer) return;

  const checkboxItems = riskRatingContainer.querySelectorAll('.bal-dropdown-link.select-category');
  checkboxItems.forEach((item) => {
    const input = item.querySelector('input[type="checkbox"]');
    const customCheckbox = item.querySelector('.w-checkbox-input');
    
    if (input && customCheckbox) {
      input.checked = false;
      customCheckbox.classList.remove('w--redirected-checked');
    }
  });

}

// Set up mobile filter modal search inputs to work like th-search
function setupMobileFilterSearch() {

  // First, find all mobile filter modal containers
  const mobileFilterModals = document.querySelectorAll('.filter-modal-mob');

  // Check each container for search inputs, create if missing
  mobileFilterModals.forEach((modalContainer, index) => {
    const balSearchContainer = modalContainer.querySelector('.bal-search');
    if (!balSearchContainer) {

      return;
    }
    
    let searchInput = balSearchContainer.querySelector('input[type="text"]');
    
    if (!searchInput) {

      // Create the missing input element
      searchInput = document.createElement('input');
      searchInput.className = 'bal-search-input search-group w-input';
      searchInput.type = 'text';
      searchInput.maxLength = 256;
      searchInput.name = 'searchInput';
      searchInput.setAttribute('data-name', 'searchInput');
      searchInput.id = `search-input-${index}`;
      
      // Determine appropriate placeholder based on modal type
      const modal = modalContainer.closest('[data-id]');
      const modalId = modal?.getAttribute('data-id');
      
      if (modalId === 'group') {
        searchInput.placeholder = 'Search by group number';
      } else if (modalId === 'categories' || modalId === 'category') {
        searchInput.placeholder = 'Search categories';
      } else if (modalId === 'code') {
        searchInput.placeholder = 'Search activities';
      } else if (modalId === 'thirdparty') {
        searchInput.placeholder = 'Search third parties';
      } else {
        searchInput.placeholder = 'Search...';
      }
      
      // Insert the input after the search icon
      const searchIcon = balSearchContainer.querySelector('.bal-search-icon');
      if (searchIcon) {
        searchIcon.insertAdjacentElement('afterend', searchInput);
      } else {
        balSearchContainer.appendChild(searchInput);
      }

    } else {

    }
  });
  
  // Now find all mobile filter search inputs (including newly created ones)
  const mobileSearchInputs = document.querySelectorAll('.filter-modal-mob input[type="text"], .bal-search-input');

  mobileSearchInputs.forEach((searchInput, index) => {
    // Try multiple ways to find the modal container
    let modal = searchInput.closest('[data-id]');
    let modalId = modal?.getAttribute('data-id');
    
    // If not found, try looking for the modal container that contains this search input
    if (!modal) {
      const filterModalContainer = searchInput.closest('.filter-modal-mob');
      if (filterModalContainer) {
        // Look for the modal in the parent elements
        modal = filterModalContainer.closest('[data-id]') || 
                filterModalContainer.parentElement?.closest('[data-id]') ||
                document.querySelector('[data-id].is-open');
        modalId = modal?.getAttribute('data-id');
      }
    }

    // Determine what type of filter this is based on modal ID first (more reliable)
    let filterType = 'unknown';
    const placeholder = searchInput.placeholder.toLowerCase();

    // Prioritize modal ID over placeholder (more reliable)
    if (modalId === 'group') {
      filterType = 'group';
    } else if (modalId === 'categories' || modalId === 'category') {
      filterType = 'category';
    } else if (modalId === 'code') {
      filterType = 'code';
    } else if (modalId === 'thirdparty') {
      filterType = 'thirdparty';
    } else {
      // Fallback to placeholder detection if no modal ID
      if (placeholder.includes('group')) {
        filterType = 'group';
      } else if (placeholder.includes('categor')) {
        filterType = 'category';
      } else if (placeholder.includes('code') || placeholder.includes('activit')) {
        filterType = 'code';
      } else if (placeholder.includes('third')) {
        filterType = 'thirdparty';
      }
    }

    // Set up real-time search with debouncing (like th-search)
    const handleFilterSearch = debounce((event) => {
      const searchTerm = event.target.value.trim().toLowerCase();

      // Get the checkbox container for this filter type
      const container = getContainerByType(filterType);
      if (!container) {

        return;
      }
      
      // Filter the checkboxes based on search term
      const checkboxItems = container.querySelectorAll('.bal-dropdown-link.select-category');
      let visibleCount = 0;
      
      checkboxItems.forEach(item => {
        const label = item.querySelector('.bal-checkbox-label');
        const itemText = label ? label.textContent.trim().toLowerCase() : '';
        
        if (!searchTerm || itemText.includes(searchTerm)) {
          item.style.display = '';
          visibleCount++;
        } else {
          item.style.display = 'none';
        }
      });

      // Show "no results" message if needed
      showNoResultsInModal(container, visibleCount === 0 && searchTerm);
      
    }, 300); // 300ms debounce like th-search
    
    // Attach the search handler
    searchInput.addEventListener('input', handleFilterSearch);
    
    // Handle Enter key
    searchInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        // The search is already happening in real-time, so just focus stays
      }
    });

  });

}

// Helper function to show/hide "no results" message in modal
function showNoResultsInModal(container, show) {
  // Remove existing "no results" message
  const existingNoResults = container.querySelector('.mobile-filter-no-results');
  if (existingNoResults) {
    existingNoResults.remove();
  }
  
  if (show) {
    // Create and add "no results" message
    const noResultsDiv = document.createElement('div');
    noResultsDiv.className = 'mobile-filter-no-results';
    noResultsDiv.style.padding = '20px';
    noResultsDiv.style.textAlign = 'center';
    noResultsDiv.style.color = '#666';
    noResultsDiv.style.fontStyle = 'italic';
    noResultsDiv.textContent = 'No matching items found';
    
    container.appendChild(noResultsDiv);
  }
  }

// Set up modal management system
function setupModalManagement() {
  // Setup each modal
  const modals = document.querySelectorAll('.bal-category-modal');
  modals.forEach(initModal);

  function initModal(modal) {
    // Delegate all clicks inside this modal
    modal.addEventListener('click', function (e) {
      // 1) MAIN CLOSE BUTTON (close the whole modal)
      // Put your main close button inside the header with class .close-category
      const mainClose = e.target.closest('.bal-category-modal-header .close-category');
      if (mainClose) {
        e.preventDefault();
        e.stopPropagation();
        closeEntireModal(modal);
        return;
      }

      // 2) OPEN SUB MODAL (match data-modal on trigger to data-id on slide)
      const openTrigger = e.target.closest('.filter-tab-click');
      if (openTrigger) {
        e.preventDefault();
        const id = (openTrigger.getAttribute('data-modal') || '').toLowerCase();
        openSubModal(modal, id);
        return;
      }

      // 3) SUB MODAL BACK (close only current sub modal)
      const backBtn = e.target.closest('.filter-group-slide .back-to-main');
      if (backBtn) {
        e.preventDefault();
        e.stopPropagation();
        const currentSlide = backBtn.closest('.filter-group-slide');
        if (currentSlide) currentSlide.classList.remove('is-open');
        return;
      }

      // 4) SUB MODAL CLOSE (close sub + main)
      const subClose = e.target.closest('.filter-group-slide .close-category');
      if (subClose) {
        e.preventDefault();
        e.stopPropagation();
        closeEntireModal(modal); // also clears any open sub
        return;
      }

      // 4.5) CLEAR BUTTON (clear filters but DON'T close modal)
      const clearBtn = e.target.closest('.btn-clear');
      if (clearBtn && clearBtn.textContent.toLowerCase().includes('clear')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Find which sub-modal this clear button is in
        const currentSubModal = clearBtn.closest('[data-id]');
        const modalId = currentSubModal?.getAttribute('data-id');
        
        // Clear filters but keep modal open
        if (modalId) {
          handleModalClearAllWithoutClosing(modalId);
        } else {
          // Fallback: Clear all filters if we can't determine the specific modal
          handleModalClearAllWithoutClosing('all');
        }
        // DON'T close the modal - user should be able to continue selecting
        return;
      }

      // 5) APPLY BUTTON (close sub + main after applying filters)
      const applyBtn = e.target.closest('.filter-submit:not(.btn-clear)');
      if (applyBtn && applyBtn.textContent.toLowerCase().includes('apply')) {
        e.preventDefault();
        e.stopPropagation();
        
        // Find which sub-modal this apply button is in
        const currentSubModal = applyBtn.closest('[data-id]');
        const modalId = currentSubModal?.getAttribute('data-id');
        
        // Apply filters first using the existing handler
        if (modalId) {
          handleModalApply(modalId);
        } else {
          // Fallback: just apply filters and close
          applyMobileFilters();
          closeEntireModal(modal);
        }
        return;
      }

      // (Optional) Overlay click to close main modal
      if (e.target.classList && e.target.classList.contains('bal-modal-overlay')) {
        e.preventDefault();
        e.stopPropagation();
        closeEntireModal(modal);
        return;
      }
    });

    // ESC closes only if this modal is open
    document.addEventListener('keydown', function onEsc(e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) {
        closeEntireModal(modal);
      }
    });
  }

  function openSubModal(mainModal, subModalId) {
    // Close any currently open sub modals
    const allSubModals = mainModal.querySelectorAll('.filter-group-slide');
    allSubModals.forEach(sub => {
      sub.classList.remove('is-open');
      sub.classList.add('is-closed');
    });
    
    // Open the requested sub modal
    const targetSubModal = mainModal.querySelector(`[data-id="${subModalId}"]`);
    if (targetSubModal) {
      targetSubModal.classList.remove('is-closed');
      targetSubModal.classList.add('is-open');
      
      // Remove any inline styles that might be hiding the modal
      targetSubModal.style.display = '';
      targetSubModal.style.visibility = '';
      targetSubModal.style.opacity = '';
    }
  }

  function closeEntireModal(mainModal) {
    // Close all sub modals first
    const allSubModals = mainModal.querySelectorAll('.filter-group-slide');
    allSubModals.forEach(sub => {
      sub.classList.remove('is-open');
      sub.classList.add('is-closed');
      // DON'T set permanent inline styles - let CSS handle visibility
    });
    
    // Close main modal
    mainModal.classList.remove('is-open');
    mainModal.classList.add('is-closed');
    // DON'T set permanent inline styles - let CSS handle visibility
    
    // Update mobile sorting display after closing
    updateMobileSortingDisplay();
  }
}

// Set up third party approval toggle and checkboxes
async function setupThirdPartyFilter() {
  // Fetch third parties from API first
    try {
      const thirdParties = await fetchThirdParties();
      if (thirdParties.length > 0) {
        populateThirdPartyCheckboxes(thirdParties);
      } else {
      }
    } catch (error) {
  }
  
  // Setup for each third-party approval widget container (desktop/mobile)
  document.querySelectorAll('.third-party-approval').forEach(function (wrap) {
    // Try multiple selectors to find the master toggle
    const master = wrap.querySelector('#select_all') || 
                   wrap.querySelector('#select_all_item') || 
                   wrap.querySelector('.bal-third-party-select .toggle input[type="checkbox"]') ||
                   wrap.querySelector('.toggle input[type="checkbox"]');
    
    if (!master) {
      return;
    }
    

    // Get all third-party checkboxes - try multiple container selectors
    const getItemCheckboxes = () => {
      // First try getting from .bal-dropdown-checkbox-wrap (dynamically populated)
      let checkboxes = wrap.querySelectorAll('.bal-dropdown-checkbox-wrap input[type="checkbox"]');
      if (checkboxes.length === 0) {
        // Fallback to .bal-select-options (if exists in HTML)
        checkboxes = wrap.querySelectorAll('.bal-select-options input[type="checkbox"]');
      }
      if (checkboxes.length === 0) {
        // Last fallback to any .bal-dropdown-link checkboxes
        checkboxes = wrap.querySelectorAll('.bal-dropdown-link input[type="checkbox"]');
      }
      return checkboxes;
    };

    // Apply state to all item checkboxes and update state
    const setAllItems = (checked) => {
      const checkboxes = getItemCheckboxes();
      
      // Clear or populate selectedThirdParties based on checked state
      if (!checked) {
        state.selectedThirdParties.clear();
      }
      
      checkboxes.forEach(function (cb) {
        if (cb.checked !== checked) {
          // Update checkbox state
          cb.checked = checked;
          
          // Trigger change event for any listeners
          triggerChange(cb);
          
          // Update state
          const thirdPartyName = cb.dataset.name || cb.nextElementSibling?.nextElementSibling?.textContent?.trim();
          if (thirdPartyName) {
            if (checked) {
              state.selectedThirdParties.add(thirdPartyName);
          } else {
            state.selectedThirdParties.delete(thirdPartyName);
            }
          }
        }
      });

      // Update visual state for ALL checkboxes after state updates
      // Use setTimeout to ensure it happens after Webflow's processing
      setTimeout(() => {
        checkboxes.forEach(function (cb) {
          const customCheckbox = cb.nextElementSibling;
          if (customCheckbox && customCheckbox.classList.contains('w-checkbox-input')) {
            if (cb.checked) {
              customCheckbox.classList.add('w--redirected-checked');
    } else {
              customCheckbox.classList.remove('w--redirected-checked');
    }
          }
        });
      }, 50);
    
      updateMasterState();
    
      // Update mobile sorting display
    updateMobileSortingDisplay();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear();
      renderPage(1);
    };

    // Keep master checkbox state (checked/indeterminate) in sync with items
    // But ONLY when clicking individual items, not when clicking the master
    const updateMasterState = (skipFilter = false) => {
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
    };

    // Handle clicks on the toggle area (label, slider, etc)
    const handleToggleClick = function(e) {
      e.preventDefault();
      e.stopPropagation();
      
      // Toggle the state manually
      const newState = !master.checked;
      master.checked = newState;
      
      
      state.thirdPartyApproval = newState;
      setAllItems(newState);
    };
    
    // Add click handler to the label (which wraps the checkbox)
    const toggleLabel = wrap.querySelector('label.switch[for="select_all"], label.switch[for="select_all_item"]');
    if (toggleLabel) {
      toggleLabel.addEventListener('click', handleToggleClick);
    }
    
    // Also add to the slider itself
    const slider = wrap.querySelector('.slider');
    if (slider) {
      slider.addEventListener('click', handleToggleClick);
    }

    // "Unselect All" button → uncheck master and all items (supports both class variants)
    const unselectBtns = wrap.querySelectorAll(
      '.bal-select-head .unselect-all, .bal-third-party-select-header .unselect-all'
    );
    
    unselectBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (master.checked || master.indeterminate) {
          master.indeterminate = false;
          master.checked = false;
          state.thirdPartyApproval = false;
          triggerChange(master);
        }
        setAllItems(false);
      });
    });
    
    // Also look for reset buttons
    const resetBtns = wrap.querySelectorAll(
      '.bal-select-head .reset-item, .bal-third-party-select-header .reset-item, .reset-all'
    );
    
    resetBtns.forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (master.checked || master.indeterminate) {
          master.indeterminate = false;
          master.checked = false;
          state.thirdPartyApproval = false;
          triggerChange(master);
        }
        setAllItems(false);
      });
    });

    // Keep master updated when user clicks individual items
    wrap.addEventListener('change', function (e) {
      // Check if the target is a third-party checkbox (not the master toggle)
      if (e.target.type === 'checkbox' && 
          e.target !== master &&
          (e.target.matches('.bal-select-options input[type="checkbox"]') || 
           e.target.matches('.bal-dropdown-link input[type="checkbox"]') ||
           e.target.matches('.bal-dropdown-checkbox-wrap input[type="checkbox"]'))) {
        
        // Update visual state for custom checkboxes
        const customCheckbox = e.target.nextElementSibling;
        const isChecked = e.target.checked;
        
        if (customCheckbox && customCheckbox.classList.contains('w-checkbox-input')) {
          // Apply the class immediately
          if (isChecked) {
            customCheckbox.classList.add('w--redirected-checked');
          } else {
            customCheckbox.classList.remove('w--redirected-checked');
          }
          
          // Webflow might be removing our class, so re-apply it after a short delay
          setTimeout(() => {
            if (isChecked) {
              customCheckbox.classList.add('w--redirected-checked');
            } else {
              customCheckbox.classList.remove('w--redirected-checked');
            }
          }, 50);
        }
        
        // Update state - get the third party name from data-name attribute or label text
        const thirdPartyName = e.target.dataset.name || 
                               e.target.nextElementSibling?.nextElementSibling?.textContent?.trim();
        if (thirdPartyName) {
          if (e.target.checked) {
            state.selectedThirdParties.add(thirdPartyName);
          } else {
            state.selectedThirdParties.delete(thirdPartyName);
          }
        }
        
        updateMasterState();
        
        // Update mobile sorting display
        updateMobileSortingDisplay();
        
        // Reset to first page and reload data
        state.currentPage = 1;
        cache.clear();
        renderPage(1);
      }
    });

    // Don't interfere with the toggle - let it work naturally
    // The dropdown might close, but the toggle will work properly

    // Initialize state on load
    updateMasterState();
  });
  }
  
  // ─── FAWRI Activities Toggle Setup ─────────────────────────────
  
  function setupFawriToggle() {

    // Setup desktop toggle
    setupDesktopFawriToggle();
    
    // Setup mobile toggle
    setupMobileFawriToggle();
    
    // Initialize with Regular Activities active
    updateFawriToggleActive();
  }
  
  function setupDesktopFawriToggle() {
    // Check if the desktop FAWRI toggle elements exist
    if (!dom.regularActivitiesTab || !dom.fawriActivitiesTab) {

      return;
    }

    // Set up Regular Activities tab click handler
    dom.regularActivitiesTab.addEventListener('click', (event) => {
      event.preventDefault();

      // Update state
      state.fawriMode = false;
      
      // Update active classes
      updateFawriToggleActive();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
    
    // Set up FAWRI Activities tab click handler
    dom.fawriActivitiesTab.addEventListener('click', (event) => {
      event.preventDefault();

      // Update state
      state.fawriMode = true;
      
      // Update active classes
      updateFawriToggleActive();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
  }
  
  function setupMobileFawriToggle() {
    // Check if the mobile FAWRI toggle elements exist
    if (!dom.mobileRegularActivitiesTab || !dom.mobileFawriActivitiesTab) {

      return;
    }

    // Set up Mobile Regular Activities tab click handler
    dom.mobileRegularActivitiesTab.addEventListener('click', (event) => {
      event.preventDefault();

      // Update state
      state.fawriMode = false;
      
      // Update active classes
      updateFawriToggleActive();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
    
    // Set up Mobile FAWRI Activities tab click handler
    dom.mobileFawriActivitiesTab.addEventListener('click', (event) => {
      event.preventDefault();

      // Update state
      state.fawriMode = true;
      
      // Update active classes
      updateFawriToggleActive();
      
      // Reset to first page and reload data
      state.currentPage = 1;
      cache.clear(); // Clear cache when changing filters
      renderPage(1);
    });
  }
  
  function updateFawriToggleActive() {
    // Update desktop toggle active state
    if (dom.regularActivitiesTab && dom.fawriActivitiesTab) {
      // Remove active class from both desktop tabs
      dom.regularActivitiesTab.classList.remove('is-active');
      dom.fawriActivitiesTab.classList.remove('is-active');
      
      // Add active class to the appropriate desktop tab
      if (state.fawriMode) {
        dom.fawriActivitiesTab.classList.add('is-active');
      
      } else {
        dom.regularActivitiesTab.classList.add('is-active');
      
      }
    }
    
    // Update mobile toggle active state
    if (dom.mobileRegularActivitiesTab && dom.mobileFawriActivitiesTab) {
      // Remove active class from both mobile tabs
      dom.mobileRegularActivitiesTab.classList.remove('is-active');
      dom.mobileFawriActivitiesTab.classList.remove('is-active');
      
      // Add active class to the appropriate mobile tab
      if (state.fawriMode) {
        dom.mobileFawriActivitiesTab.classList.add('is-active');
      
      } else {
        dom.mobileRegularActivitiesTab.classList.add('is-active');
      
      }
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
        
        // Detailed error messages for each missing element
        if (!dom.tableEl) // 
        if (!dom.tableBodyEl) // 
        
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
    
      await initCategoryRadios();
      
      // Set up mobile sorting
    
      await initMobileSorting();
      
      // Always default to 'All Categories' on page load
      state.currentCategory = '';
      state.currentGroup = '';
      state.codeSortOrder = 'ascending'; // Default sort order
      
      // Update active classes
      updateActiveCategoryClass();
      
      // Set up infinite scroll
("Setting up infinite scroll...");
      setupInfiniteScroll();
      
      // Set up third party approval filter
("Setting up third party approval filter...");
      setupThirdPartyFilter();
    
    // Set up approval stage filter

    setupApprovalStageFilter();
    
    // Set up risk rating filter

    setupRiskRatingFilter();
      
      // Set up FAWRI Activities toggle
    
      setupFawriToggle();
      
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
      dom.searchInputs = document.querySelectorAll('#search-input, .bal-search-input, input[name="searchInput"], .main-search input[type="text"]');
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
      
      // Set up modal footer buttons (disabled - using modal management system instead)
      // setupModalFooterButtons();
      
      // Also set up event delegation for modal buttons (disabled - using modal management system instead)
      // setupModalButtonDelegation();

    // Set up mobile filter modal search inputs
    setupMobileFilterSearch();
    
    // Set up modal management system
    setupModalManagement();
    
    // Prevent form submissions in modal footers (disabled - using modal management system instead)
    // preventModalFormSubmissions();
      
("Initialization complete");
      
    } catch (error) {
        // 
      // 
    }
  }
  
  // Set up infinite scroll functionality
  function setupInfiniteScroll() {
("Setting up infinite scroll handler");
    
    // Use a debounce function to prevent multiple calls
    let scrollTimeout;
    let isLoading = false;
    
    // Use passive event listeners for better performance
    const scrollHandler = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        // Check if we're near the bottom of the page
        const scrollPosition = window.scrollY + window.innerHeight;
        const documentHeight = document.documentElement.scrollHeight;
        
        // Different thresholds for mobile vs desktop
        const threshold = isMobileView() ? 0.9 : 0.8; // Mobile loads later to reduce battery usage
        
        // Load more when user scrolls to threshold of the page
        if (scrollPosition > documentHeight * threshold && !isLoading) {
    ("Scroll threshold reached, loading more data");
          isLoading = true;
          
          // Load next page
          const nextPage = state.currentPage + 1;
          renderPage(nextPage, true).finally(() => {
            isLoading = false;
          });
        }
      }, isMobileView() ? 150 : 100); // Longer debounce on mobile
    };
    
    window.addEventListener('scroll', scrollHandler, { passive: true });
  }

  // ─── Handle window resize for responsive switching ─────────────
  let resizeTimeout;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      // Clear cache on view change to force re-render with correct layout
      cachedMobileElements = null;
      lastMobileState = null;
      
      // Re-render current page when switching between mobile/desktop
      if (state.currentPage) {
        renderPage(state.currentPage);
      }
    }, 300); // Debounce resize events
  });

  // ─── Event Delegation for Better Performance ─────────────────
  function setupEventDelegation() {
    // Delegate click events for better performance
    document.addEventListener('click', (e) => {
      // Handle copy button clicks
      if (e.target.closest('.btn-copy')) {
        console.log("Copy button clicked!");
        e.preventDefault();
        e.stopPropagation();
        const copyBtn = e.target.closest('.btn-copy');
        const row = copyBtn.closest('tr, .bal-wrapper');
        
        console.log("Row found:", row);
        console.log("Row dataset:", row?.dataset);
        
        let activityName = '';
        if (row && row.dataset.activityData) {
          const data = JSON.parse(row.dataset.activityData);
          activityName = data['Activity Name'] || '';
          console.log("Activity name from dataset:", activityName);
        } else {
          // Fallback for mobile items
          const nameElement = row?.querySelector('.bal-category-item-name, .td-text');
          activityName = nameElement ? nameElement.textContent : '';
          console.log("Activity name from element:", activityName);
        }
        
        if (activityName) {
          console.log("Copying to clipboard:", activityName);
          navigator.clipboard.writeText(activityName)
            .then(() => {
              console.log("Copied successfully!");
              // Show feedback
              const originalColor = copyBtn.style.color;
              copyBtn.style.color = '#056633';
              setTimeout(() => {
                copyBtn.style.color = originalColor;
              }, 1000);
            })
            .catch(err => {
              console.error("Copy failed:", err);
            });
        } else {
          console.log("No activity name found to copy");
        }
      }
      
      // Handle save button clicks
      if (e.target.closest('.btn-save')) {
        console.log("Save button clicked!");
        e.preventDefault();
        e.stopPropagation();
        const saveBtn = e.target.closest('.btn-save');
        const row = saveBtn.closest('tr, .bal-wrapper');
        
        console.log("Save row found:", row);
        console.log("Save row dataset:", row?.dataset);
        
        if (row && row.dataset.activityData) {
          const data = JSON.parse(row.dataset.activityData);
          console.log("Toggling saved item:", data);
          toggleSavedItem(data, saveBtn, row);
        } else {
          console.log("No activity data found for save");
        }
      }
    });
  }

  // ─── Start on DOM ready ────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initialize();
      setupEventDelegation();
    });
  } else {
    initialize();
    setupEventDelegation();
  }

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
    // 
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
        // 
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
                // 
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
