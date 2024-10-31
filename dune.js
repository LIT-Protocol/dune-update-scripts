async function createTable() {
    const schema = [
        { name: "wallet_address", type: "varchar" },
        { name: "total_usd_value", type: "integer" },
    ];

    let dune_namespace = process.env.DUNE_NAMESPACE;
    let table_name = "genius_wk";

    const endpoint = `/v1/table/create`;
    const url = `${DUNE_URL}${endpoint}`;

    const payload = {
        namespace: dune_namespace,
        table_name: table_name,
        description: "genius wrapped keys from api",
        schema: schema,
        is_private: false,
    };

    const headers = {
        "X-DUNE-API-KEY": `${process.env.DUNE_API_KEY}`,
        "Content-Type": "application/json",
    };

    try {
        const response = await axios.post(url, payload, {
            headers,
        });
        return response;
    } catch (error) {
        console.error("Error updating Dune table:", error);
        throw error;
    }
}


// export async function updateDuneTableData(_data) {
// fetch existing data from db
// const query_id = process.env.DUNE_QUERY_ID_WK;
// const endpointQuery = `/v1/query/${query_id}/results/csv`;
// const url = `${DUNE_URL}${endpointQuery}`;

//     const getTableCsvData = await fetchTableData();
//     console.log("getTableCsvData: ", getTableCsvData);

//     _data = convertToCSV(_data);

//     // update the existing table if data exist or add new data
//     let updatedCsvData;
//     if (getTableCsvData) {
//         const dataWithoutHeader = _data.split("\n").slice(1).join("\n");
//         updatedCsvData = getTableCsvData + "\n" + dataWithoutHeader;
//     } else {
//         updatedCsvData = _data;
//     }

//     const dune_namespace = process.env.DUNE_NAMESPACE;
//     const table_name = process.env.DUNE_TABLE_NAME_YELLOWSTONE_DATIL;

//     // append in existing db
//     try {
//         const endpoint = `/v1/table/${dune_namespace}/${table_name}/insert`;
//         const url = `${DUNE_URL}${endpoint}`;

//         const config = {
//             headers: {
//                 "X-DUNE-API-KEY": process.env.DUNE_API_KEY,
//                 "Content-Type": "application/json",
//             },
//         };

//         const response = await axios.post(url, updatedCsvData, config);
//         // return response;
//     } catch (error) {
//         console.error("Error updating Dune table:", error);
//         throw error;
//     }

//     // refresh db with new data
//     try {
//         const query_id = process.env.DUNE_QUERY_ID_YELLOWSTONE_DATIL;
//         const endpoint = `/v1/query/${query_id}/execute`;
//         const url = `${DUNE_URL}${endpoint}`;

//         const config = {
//             headers: {
//                 "X-DUNE-API-KEY": process.env.DUNE_API_KEY,
//             },
//         };
//         const response = await axios.post(url, null, config);
//     } catch (error) {
//         console.error("Error updating Dune table:", error);
//         throw error;
//     }
// }
