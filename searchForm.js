var SearchForm = {
    container: "",
    mapInstance: null,

    formData: {
        get ort() {
            return document.querySelector(SearchForm.container + " input[name=ort]").value;
        },
        set ort(val) {
            document.querySelector(SearchForm.container + " input[name=ort]").value = val;
        }
    },

    searchLocation() {
        const self = this;
        const query = self.formData.ort;

        const url = new URL("https://nominatim.openstreetmap.org/search");
        url.search = new URLSearchParams({
            q: query,
            format: "json"
        }).toString();

        fetch(url)
            .then(response => {
                if (!response.ok) throw new Error("HTTP error " + response.status);
                return response.json();
            })
            .then(data => {
                if (Array.isArray(data) && data.length > 0) {
                    const result = {
                        lon: parseFloat(data[0].lon),
                        lat: parseFloat(data[0].lat)
                    };
                    self.centerMap(result);
                } else {
                    self.formData.ort = "Not found.";
                }
            })
            .catch(error => {
                self.formData.ort = "Request failed. " + error;
            });
    },

    centerMap(pos) {
        this.mapInstance.setView(pos, 15);
    }
};
