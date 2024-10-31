const axios = require("axios");
require("dotenv").config();

const DUNE_URL = "https://api.dune.com/api";

async function callGeniusAPI() {
    const API_URL =
        "https://staging-api.tradegenius.com/indexer/reports/wallets";
    const BATCH_SIZE = 1000;

    console.log("Starting data collection...");

    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(
                `${API_URL}?limit=${BATCH_SIZE}&offset=${offset}`
            );
            const result = await response.json();

            if (result.status !== "success") {
                throw new Error("API request failed");
            }

            const { data } = result;
            allData = [...allData, ...data];

            // Check if we've received less than the batch size
            if (data.length < BATCH_SIZE) {
                hasMore = false;
            } else {
                offset += BATCH_SIZE;
            }
        } catch (error) {
            console.error("Error fetching data:", error);
            hasMore = false;
        }
    }

    console.log(`Collected ${allData.length} wallet records`);

    const csvString =
        "wallet_address,total_usd_value" +
        allData.reduce((acc, item) => {
            return (
                acc + "\\n" + `${item.wallet_address},${item.total_usd_value}`
            );
        }, "");

    return csvString.toString();
}

async function updateGeniusWkTableData(_data) {
    // get updated data
    let csvData = await callGeniusAPI();
    csvData = `"${csvData}"`;
    console.log("csv data: ", csvData);

    // update the db
    try {
        const response = await axios.post(
            "https://api.dune.com/api/v1/table/upload/csv",
            {
                data: csvData,
                description: "WK from Genius API",
                table_name: process.env.DUNE_TABLE_NAME_GENIUS_WK,
                is_private: false,
            },
            {
                headers: {
                    "X-DUNE-API-KEY": process.env.DUNE_API_KEY,
                    "Content-Type": "application/json",
                },
            }
        );

        console.log("response: ", response.data);
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }

    // refresh db by running query
    try {
        const query_id = process.env.DUNE_QUERY_ID_GENIUS_WK;
        const endpoint = `/v1/query/${query_id}/execute`;
        const url = `${DUNE_URL}${endpoint}`;

        const config = {
            headers: {
                "X-DUNE-API-KEY": process.env.DUNE_API_KEY,
            },
        };
        const response = await axios.post(url, null, config);
        console.log("response: ", response.data);
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}

updateGeniusWkTableData();