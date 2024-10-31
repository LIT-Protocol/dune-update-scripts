const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const CSV_FOLDER = path.join(__dirname, 'csv');

const firstFile = path.join(CSV_FOLDER, 'pkp-16-10-24..csv');
const secondFile = path.join(CSV_FOLDER, 'pkp-31-10-24.csv');
const outputFile = path.join(CSV_FOLDER, 'yellowstone_31_10_24.csv');

const headers = [
    {id: 'Blockchain', title: 'Blockchain'},
    {id: 'Network', title: 'Network'},
    {id: 'Token ID', title: 'Token ID'},
    {id: 'ETH Address', title: 'ETH Address'},
    {id: 'BTC P2PKH', title: 'BTC P2PKH'},
    {id: 'BTC P2WPKH', title: 'BTC P2WPKH'},
    {id: 'BTC P2SHP2WPKH', title: 'BTC P2SHP2WPKH'},
    {id: 'BTC P2TR', title: 'BTC P2TR'},
    {id: 'BTC P2WSH', title: 'BTC P2WSH'},
    {id: 'BTC P2SH', title: 'BTC P2SH'}
];

const csvWriter = createCsvWriter({
    path: outputFile,
    header: headers
});

function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const results = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (data) => results.push(data))
            .on('end', () => resolve(results))
            .on('error', (error) => reject(error));
    });
}

async function combineCSVFiles() {
    try {
        console.log('Reading first file...');
        const firstFileData = await readCsvFile(firstFile);
        
        console.log('Reading second file...');
        const secondFileData = await readCsvFile(secondFile);
        
        const combinedData = [...firstFileData, ...secondFileData];
        
        console.log('Writing combined data to new file...');
        await csvWriter.writeRecords(combinedData);
        
        console.log(`Successfully combined files into ${outputFile}`);
    } catch (error) {
        console.error('Error combining CSV files:', error);
    }
}

combineCSVFiles();