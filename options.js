document.querySelector("form").addEventListener("change", (e) => {
	const settings = {
		'protectDuplicates': document.querySelector("#protect_duplicates").checked,
		'moveOlder': document.querySelector("#move_older").checked,
		'checkMultiWindow': document.querySelector("#check_multiwindow").checked,
		'enableWhitelist': document.querySelector("#enable_whitelist").checked
	};
	
	browser.storage.sync.set(settings);
	
	// Show/hide whitelist section
	const whitelistSection = document.querySelector("#whitelist_section");
	whitelistSection.style.display = settings.enableWhitelist ? "block" : "none";
});

// Whitelist management functions
let whitelistDomains = [];
let whitelistUrls = [];

const renderWhitelistItems = () => {
	const domainsList = document.querySelector("#domains_list");
	const urlsList = document.querySelector("#urls_list");
	
	domainsList.innerHTML = "";
	urlsList.innerHTML = "";
	
	whitelistDomains.forEach(domain => {
		const li = document.createElement("li");
		li.className = "whitelist-item";
		li.innerHTML = `
			<span>${domain}</span>
			<button onclick="removeDomain('${domain}')">${browser.i18n.getMessage('remove')}</button>
		`;
		domainsList.appendChild(li);
	});
	
	whitelistUrls.forEach(url => {
		const li = document.createElement("li");
		li.className = "whitelist-item";
		li.innerHTML = `
			<span title="${url}">${url.length > 50 ? url.substring(0, 47) + '...' : url}</span>
			<button onclick="removeUrl('${url}')">${browser.i18n.getMessage('remove')}</button>
		`;
		urlsList.appendChild(li);
	});
};

const addDomain = () => {
	const input = document.querySelector("#domain_input");
	const domain = input.value.trim();
	
	if (domain && !whitelistDomains.includes(domain)) {
		whitelistDomains.push(domain);
		browser.storage.sync.set({ whitelistDomains });
		input.value = "";
		renderWhitelistItems();
	}
};

const addUrl = () => {
	const input = document.querySelector("#url_input");
	const url = input.value.trim();
	
	if (url && !whitelistUrls.includes(url)) {
		try {
			new URL(url); // Validate URL
			whitelistUrls.push(url);
			browser.storage.sync.set({ whitelistExactUrls: whitelistUrls });
			input.value = "";
			renderWhitelistItems();
		} catch (e) {
			alert(browser.i18n.getMessage('invalidUrl'));
		}
	}
};

const removeDomain = (domain) => {
	whitelistDomains = whitelistDomains.filter(d => d !== domain);
	browser.storage.sync.set({ whitelistDomains });
	renderWhitelistItems();
};

const removeUrl = (url) => {
	whitelistUrls = whitelistUrls.filter(u => u !== url);
	browser.storage.sync.set({ whitelistExactUrls: whitelistUrls });
	renderWhitelistItems();
};

// Make functions global for onclick handlers
window.removeDomain = removeDomain;
window.removeUrl = removeUrl;

document.addEventListener("DOMContentLoaded", () => {
	browser.storage.sync.get(null).then(data => {
		document.querySelector("#protect_duplicates").checked = 'protectDuplicates' in data?
				data.protectDuplicates : true;
		
		document.querySelector("#move_older").checked = 'moveOlder' in data?
				data.moveOlder : true;
		
		document.querySelector("#check_multiwindow").checked = 'checkMultiWindow' in data?
				data.checkMultiWindow : false;
		
		document.querySelector("#enable_whitelist").checked = 'enableWhitelist' in data?
				data.enableWhitelist : false;
		
		// Show/hide whitelist section
		const whitelistSection = document.querySelector("#whitelist_section");
		whitelistSection.style.display = data.enableWhitelist ? "block" : "none";
		
		// Load whitelist data
		whitelistDomains = data.whitelistDomains || [];
		whitelistUrls = data.whitelistExactUrls || [];
		renderWhitelistItems();
	});
	
	// Add event listeners
	document.querySelector("#add_domain").addEventListener("click", addDomain);
	document.querySelector("#add_url").addEventListener("click", addUrl);
	
	document.querySelector("#domain_input").addEventListener("keypress", (e) => {
		if (e.key === "Enter") addDomain();
	});
	
	document.querySelector("#url_input").addEventListener("keypress", (e) => {
		if (e.key === "Enter") addUrl();
	});
});
