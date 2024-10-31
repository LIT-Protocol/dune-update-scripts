const fs = require('fs');
const path = require('path');

const API_URL = 'https://staging-api.tradegenius.com/indexer/reports/wallets';
const BATCH_SIZE = 1000;
const CSV_DIR = 'csv';

async function createCSVDump() {
    console.log('Starting data collection...');

    // Create csv directory if it doesn't exist
    if (!fs.existsSync(CSV_DIR)) {
        fs.mkdirSync(CSV_DIR);
        console.log('Created csv directory');
    }

    let allData = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        try {
            const response = await fetch(`${API_URL}?limit=${BATCH_SIZE}&offset=${offset}`);
            const result = await response.json();

            if (result.status !== 'success') {
                throw new Error('API request failed');
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
            console.error('Error fetching data:', error);
            hasMore = false;
        }
    }

    console.log(`Collected ${allData.length} wallet records`);

    const date = new Date();
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString().slice(-2);
    
    const fileName = `genius_wk_${day}_${month}_${year}`;
    
    const csvContent = [
        'wallet_address,total_usd_value',
        ...allData.map(item => `${item.wallet_address},${item.total_usd_value}`)
    ].join('\n');
    
    const filePath = path.join(CSV_DIR, `${fileName}.csv`);
    fs.writeFileSync(filePath, csvContent);
    console.log(`CSV data exported successfully to ${filePath}`);

    const solanaWallets = allData.filter(entry => !entry.wallet_address.startsWith("0x"));
    const solanaCsvContent = [
        'wallet_address,total_usd_value',
        ...solanaWallets.map(item => `${item.wallet_address},${item.total_usd_value}`)
    ].join('\n');
    
    const solanaFileName = `genius_wk_solana_${day}_${month}_${year}`;
    const solanaFilePath = path.join(CSV_DIR, `${solanaFileName}.csv`);
    fs.writeFileSync(solanaFilePath, solanaCsvContent);
    console.log(`Solana CSV data exported successfully to ${solanaFilePath}`);

    console.log(`Total wallets: ${allData.length}`);
    console.log(`Solana wallets: ${solanaWallets.length}`);
}

createCSVDump().catch(console.error);