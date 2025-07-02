function SearchForm(container) {
    this.inputElement = document.querySelector(container + " input[name=ort]");
    this.eventHandler = {};
}

SearchForm.prototype.on = function (event, callback) {
    this.eventHandler[event] = callback;
}

SearchForm.prototype.search = async function () {
    const searchForm = this;
    const url = new URL("https://nominatim.openstreetmap.org/search");
    url.search = new URLSearchParams({
        q: searchForm.inputElement.value,
        format: "json"
    }).toString();

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!(Array.isArray(data) && data.length > 0)) throw new Error("Not found");

        const result = {
            lat: parseFloat(data[0].lat),
            lng: parseFloat(data[0].lon),
        };

        searchForm.inputElement.value = '';
        const handler = searchForm.eventHandler['found'];
        if (handler) handler(result);
    }
    catch (e) {
        searchForm.inputElement.value = e;
    }
}
