const sanitizeHtml = require('sanitize-html');
const { database } = require("./database");

async function MoMUMapper(data) {
    const results = {
        total: data.length,
        successful: 0,
        failed: 0,
        errors: [],
        skipped: 0
    };

    for (let i = 0; i < data.length; i++) {
        try {
            const record = data[i];

            // Validate record
            if (!record["@id"]) {
                results.skipped++;
                results.errors.push({
                    index: i,
                    reason: "Missing @id field"
                });
                continue;
            }

            if (!(record["@id"].includes("http://thesaurus.europeanafashion.eu")
                && record["@id"].includes("idc"))) {
                results.skipped++;
                results.errors.push({
                    index: i,
                    id: record["@id"],
                    reason: "Invalid URI format"
                });
                continue;
            }

            // Process record
            const processedData = {
                provenance: "MoMU",
                puri: record["@id"],
                identifier: record["http://purl.org/dc/terms/identifier"]?.[0]["@value"],
                modifiedAt: record["http://purl.org/dc/terms/modified"]?.[0]["@value"],
                labelNL: "UNAVAILABLE",
                labelFR: "UNAVAILABLE",
                labelEN: "UNAVAILABLE",
                scopeNL: "UNAVAILABLE",
                scopeFR: "UNAVAILABLE",
                scopeEN: "UNAVAILABLE"
            };

            // Process labels
            const labels = record['http://www.w3.org/2004/02/skos/core#prefLabel'];
            if (Array.isArray(labels)) {
                labels.forEach(item => {
                    const lang = item['@language'];
                    const value = item['@value'];
                    if (value) {
                        processedData[`label${lang.toUpperCase()}`] =
                            sanitizeHtml(value, {
                                allowedTags: [],
                                allowedAttributes: {}
                            });
                    }
                });
            }

            // Process scope notes
            const scopeNotes = record["http://www.w3.org/2004/02/skos/core#scopeNote"];
            if (Array.isArray(scopeNotes)) {
                scopeNotes.forEach(item => {
                    const lang = item['@language'];
                    const value = item['@value'];
                    if (value) {
                        processedData[`scope${lang.toUpperCase()}`] =
                            sanitizeHtml(value, {
                                allowedTags: [],
                                allowedAttributes: {}
                            });
                    }
                });
            }

            // Process references
            const references = record["http://www.w3.org/2004/02/skos/core#exactMatch"];
            if (Array.isArray(references)) {
                references.forEach(item => {
                    const id = item['@id'];
                    if (id.includes("aat")) {
                        processedData.aat = id;
                    }
                    if (id.includes("wikidata")) {
                        processedData.wikidata = id;
                    }
                });
            }

            // Save to database
            const dbResult = await database(processedData);
            if (dbResult.success) {
                results.successful++;
            } else {
                results.failed++;
                results.errors.push({
                    index: i,
                    puri: processedData.puri,
                    error: dbResult.error
                });
            }

        } catch (error) {
            results.failed++;
            results.errors.push({
                index: i,
                error: error.message
            });
        }

        // Progress indicator
        if ((i + 1) % 10 === 0) {
            console.log(`Processed ${i + 1}/${data.length} records...`);
        }
    }

    return results;
}

module.exports = { MoMUMapper };