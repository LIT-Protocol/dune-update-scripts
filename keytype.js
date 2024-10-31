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

    // Add key_type to each wallet entry
    const walletsWithKeyType = allData.map(item => ({
        ...item,
        key_type: item.wallet_address.startsWith("0x") ? "secp256k1" : "ed25519"
    }));
    
    const csvContent = [
        'wallet_address,total_usd_value,key_type',
        ...walletsWithKeyType.map(item => 
            `${item.wallet_address},${item.total_usd_value},${item.key_type}`
        )
    ].join('\n');
    
    const filePath = path.join(CSV_DIR, `${fileName}.csv`);
    fs.writeFileSync(filePath, csvContent);
    console.log(`CSV data exported successfully to ${filePath}`);

    // Log statistics
    const solanaWallets = walletsWithKeyType.filter(entry => entry.key_type === "ed25519");
    console.log(`Total wallets: ${allData.length}`);
    console.log(`Solana wallets (ed25519): ${solanaWallets.length}`);
    console.log(`Other wallets (secp256k1): ${allData.length - solanaWallets.length}`);
}

createCSVDump().catch(console.error);