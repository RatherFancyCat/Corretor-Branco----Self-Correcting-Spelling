const typoInput = document.getElementById("typoInput");
const correctionInput = document.getElementById("correctionInput");
const addBtn = document.getElementById("addBtn");
const exportBtn = document.getElementById("exportBtn");
const importBtn = document.getElementById("importBtn");
const importInput = document.getElementById("importInput");
const dictList = document.getElementById("dictList");
const dictTable = document.getElementById("dictTable");
const dictContainer = document.getElementById("dictContainer");
const loadingMsg = document.getElementById("loadingMsg");
const searchInput = document.getElementById("searchInput");

// Load the default dictionary
const defaultDict = {};

let currentUserDict = {};
let currentMergedDict = {};
const PAGE_SIZE = 100;
let currentPage = 1;
let filteredEntries = [];

function renderDict(userDict, filter = "") {
  // Merge defaultDict and userDict, userDict takes precedence
  const merged = { ...defaultDict, ...userDict };
  currentMergedDict = merged;
  dictList.innerHTML = "";

  // Filter logic
  const filterLower = filter.trim().toLowerCase();
  filteredEntries = Object.entries(merged).filter(([typo, correction]) => {
    return (
      typo.toLowerCase().includes(filterLower) ||
      correction.toLowerCase().includes(filterLower)
    );
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredEntries.length / PAGE_SIZE);
  if (currentPage > totalPages) currentPage = 1;
  const startIdx = (currentPage - 1) * PAGE_SIZE;
  const endIdx = startIdx + PAGE_SIZE;
  const pageEntries = filteredEntries.slice(startIdx, endIdx);

  if (pageEntries.length === 0) {
    dictList.innerHTML = `<tr><td colspan="3" style="color:#888;font-style:italic;">0 palavras encontradas.</td></tr>`;
  } else {
    pageEntries.forEach(([typo, correction]) => {
      const isUser = Object.prototype.hasOwnProperty.call(userDict, typo);
      const removeBtn = isUser
        ? `<span class="remove-btn" data-key="${typo}">[Remover]</span>`
        : "";
      dictList.innerHTML += `<tr>
        <td>${typo}</td>
        <td>${correction}</td>
        <td>${removeBtn}</td>
      </tr>`;
    });
  }

  // Render pagination controls
  renderPaginationControls(totalPages);

  // --- FIX: Attach remove event listeners after rendering ---
  document.querySelectorAll(".remove-btn").forEach(btn => {
    btn.onclick = (e) => {
      const key = e.target.getAttribute("data-key");
      chrome.storage.local.get(["autocorrect_dict"], (result) => {
        const dict = result.autocorrect_dict || {};
        delete dict[key];
        chrome.storage.local.set({ autocorrect_dict: dict }, () => loadDict());
      });
    };
  });
}

function renderPaginationControls(totalPages) {
  let paginationHtml = "";
  if (totalPages > 1) {
    paginationHtml += `<tr><td colspan="3" style="text-align:center;">`;
    if (currentPage > 1) {
      paginationHtml += `<button id="prevPageBtn">Anterior</button>`;
    }
    paginationHtml += ` Página ${currentPage} de ${totalPages} `;
    if (currentPage < totalPages) {
      paginationHtml += `<button id="nextPageBtn">Próxima</button>`;
    }
    paginationHtml += `</td></tr>`;
    dictList.innerHTML += paginationHtml;

    // Add event listeners
    if (currentPage > 1) {
      document.getElementById("prevPageBtn").onclick = () => {
        currentPage--;
        renderDict(currentUserDict, searchInput.value);
      };
    }
    if (currentPage < totalPages) {
      document.getElementById("nextPageBtn").onclick = () => {
        currentPage++;
        renderDict(currentUserDict, searchInput.value);
      };
    }
  }
}

// Add remove event listeners for user-added words only
document.querySelectorAll(".remove-btn").forEach(btn => {
  btn.onclick = (e) => {
    const key = e.target.getAttribute("data-key");
    chrome.storage.local.get(["autocorrect_dict"], (result) => {
      const dict = result.autocorrect_dict || {};
      delete dict[key];
      chrome.storage.local.set({ autocorrect_dict: dict }, () => loadDict());
    });
  };
});

function loadDict() {
  loadingMsg.style.display = "block";
  // dictTable.style.display = "none";
  chrome.storage.local.get(["autocorrect_dict"], (result) => {
    const dict = result.autocorrect_dict || {};
    currentUserDict = dict;
    renderDict(dict, searchInput.value);
    loadingMsg.style.display = "none";
    dictTable.style.display = "";
  });
}

addBtn.onclick = () => {
  const typo = typoInput.value.trim();
  const correction = correctionInput.value.trim();
  if (!typo || !correction) {
    alert("Insere algo em ambos os campos.");
    return;
  }
  chrome.storage.local.get(["autocorrect_dict"], (result) => {
    const dict = result.autocorrect_dict || {};
    dict[typo] = correction;
    chrome.storage.local.set({ autocorrect_dict: dict }, () => {
      typoInput.value = "";
      correctionInput.value = "";
      loadDict();
    });
  });
};

exportBtn.onclick = () => {
  chrome.storage.local.get(["autocorrect_dict"], (result) => {
    const dict = result.autocorrect_dict || {};
    const csv = Object.entries(dict)
      .map(([k, v]) => `${JSON.stringify(k)},${JSON.stringify(v)}`)
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "autocorrect-dictionary.csv";
    a.click();
  });
};

// Import button triggers hidden file input
importBtn.onclick = () => {
  importInput.value = "";
  importInput.click();
};

importInput.onchange = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const lines = ev.target.result.split("\n");
    const imported = {};
    for (const line of lines) {
      if (!line.trim()) continue; // skip empty lines
      // Split only on the first comma
      const commaIdx = line.indexOf(",");
      if (commaIdx === -1) continue;
      try {
        const typo = JSON.parse(line.slice(0, commaIdx));
        const correction = JSON.parse(line.slice(commaIdx + 1));
        imported[typo] = correction;
      } catch (err) {
        // Ignore malformed lines
      }
    }
    chrome.storage.local.get(["autocorrect_dict"], (result) => {
      const dict = result.autocorrect_dict || {};
      const merged = { ...dict, ...imported };
      chrome.storage.local.set({ autocorrect_dict: merged }, () => loadDict());
    });
  };
  reader.readAsText(file);
};

// Search on button click
document.getElementById('searchBtn').onclick = () => {
  renderDict(currentUserDict, searchInput.value);
};

// Search on Enter key
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    renderDict(currentUserDict, searchInput.value);
  }
});

// Initial load
loadDict();
