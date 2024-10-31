const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");
const bitcoin = require("bitcoinjs-lib");
const ecc = require("@bitcoin-js/tiny-secp256k1-asmjs");
bitcoin.initEccLib(ecc);
require("dotenv").config();

// Define available blockchains with their respective RPC URLs and chain IDs
const blockchains = {
    chronicle: {
        rpcUrl:
            process.env.CHRONICLE_RPC_URL ||
            "https://chain-rpc.litprotocol.com/replica-http",
        chainId: 175177,
    },
    yellowstone: {
        rpcUrl:
            process.env.YELLOWSTONE_RPC_URL ||
            "https://yellowstone-rpc.litprotocol.com/",
        chainId: 175188,
    },
};

// Define the contracts (networks) with their respective addresses
const networks = {
    // cayenne: "0x58582b93d978F30b4c4E812A16a7b31C035A69f7",
    // habanero: "0x80182Ec46E3dD7Bb8fa4f89b48d303bD769465B2",
    // manzano: "0x3c3ad2d238757Ea4AF87A8624c716B11455c1F9A",
    // serrano: "0x8F75a53F65e31DD0D2e40d0827becAaE2299D111",
    datil_prod: "0x487A9D096BB4B7Ac1520Cb12370e31e677B175EA",
    datil_dev: "0x02C4242F72d62c8fEF2b2DB088A35a9F4ec741C7",
    datil_test: "0x6a0f439f064B7167A8Ea6B22AcC07ae5360ee0d1",
};

// ABI for the contract, including the PKPMinted event and getEthAddress function
const contractABI = [
    {
        anonymous: false,
        inputs: [
            {
                indexed: true,
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
            {
                indexed: false,
                internalType: "bytes",
                name: "pubkey",
                type: "bytes",
            },
        ],
        name: "PKPMinted",
        type: "event",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "tokenId",
                type: "uint256",
            },
        ],
        name: "getEthAddress",
        outputs: [
            {
                internalType: "address",
                name: "",
                type: "address",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];

async function fetchPKPs(
    startBlock,
    endBlock,
    _blockchain,
    _network,
    _provider
) {
    // Retrieve configuration from environment variables
    const selectedBlockchain = _blockchain;
    const selectedNetwork = _network;
    const provider = _provider;
    const blockInterval = parseInt(process.env.BLOCK_INTERVAL, 10) || 25000;

    // Ensure both blockchain and network are specified
    if (!selectedBlockchain) {
        throw new Error(
            "Both BLOCKCHAIN must be specified in the environment variables."
        );
    }

    let results = [];
    const networksToUse =
        selectedNetwork === "all" ? Object.keys(networks) : [selectedNetwork];

    // Iterate over each selected network (contract)
    for (const network of networksToUse) {
        // Get the contract address for the specified network
        const contractAddress = networks[network];
        if (!contractAddress) {
            throw new Error(`Invalid network specified: ${selectedNetwork}`);
        }

        const contract = new ethers.Contract(
            contractAddress,
            contractABI,
            provider
        );

        // Iterate through the blocks in intervals to query events
        for (
            let fromBlock = startBlock;
            fromBlock <= endBlock;
            fromBlock += blockInterval
        ) {
            const toBlock = Math.min(fromBlock + blockInterval - 1, endBlock);
            const filter = {
                address: contractAddress,
                fromBlock: fromBlock,
                toBlock: toBlock,
                topics: [ethers.utils.id("PKPMinted(uint256,bytes)")],
            };

            try {
                // Query events for the specified range of blocks
                const events = await contract.queryFilter(
                    filter,
                    fromBlock,
                    toBlock
                );
                console.log(
                    `Found ${events.length} PKPMinted events from block ${fromBlock} to ${toBlock} on ${selectedBlockchain} blockchain and ${network} network`
                );
                for (const event of events) {
                    const tokenId = event.args.tokenId.toString();
                    const publicKey = event.args.pubkey;
                    const { p2pkh, p2wpkh, p2shP2wpkh, p2tr, p2wsh, p2sh } =
                    calculateBtcAddresses(publicKey);   
                    try {
                        // Fetch the ETH address associated with the tokenId
                        const ethAddress = await contract.getEthAddress(
                            tokenId
                        );
                        const result = `Blockchain: ${selectedBlockchain}, Network: ${network}, Token ID: ${tokenId} -> ETH Address: ${ethAddress}`;
                        console.log(result);
                        results.push({
                            blockchain: selectedBlockchain,
                            network: network,
                            tokenId,
                            ethAddress,
                            p2pkh,
                            p2wpkh,
                            p2shP2wpkh,
                            p2tr,
                            p2wsh,
                            p2sh,
                        });
                    } catch (error) {
                        console.error(
                            `Error fetching ETH address for Token ID ${tokenId} on ${selectedBlockchain} blockchain, ${selectedNetwork} network:`,
                            error
                        );
                    }
                }
            } catch (error) {
                console.error(
                    `Error fetching events from block ${fromBlock} to ${toBlock} on ${selectedBlockchain} blockchain, ${selectedNetwork} network:`,
                    error
                );
            }

            // Add a delay between queries to avoid overloading the provider
            await new Promise((res) => setTimeout(res, 2000)); // 2 second delay
        }
    }

    // Format and return results
    results = cleanArray(results);
    return results;
}

function calculateBtcAddresses(publicKey) {
    if (publicKey.startsWith("0x")) {
        publicKey = publicKey.slice(2);
    }

    // Check if the public key is in uncompressed format (starts with 04)
    const isUncompressed = publicKey.startsWith("04");
    let pubKeyBuffer;

    if (isUncompressed) {
        pubKeyBuffer = Buffer.from(
            ecc.pointCompress(Buffer.from(publicKey, "hex"), true)
        );
    } else {
        pubKeyBuffer = Buffer.from(publicKey, "hex");
    }

    const network = bitcoin.networks.bitcoin;

    // P2PKH (Legacy address)
    const p2pkh = bitcoin.payments.p2pkh({
        pubkey: pubKeyBuffer,
        network,
    }).address;

    // P2WPKH (Native SegWit address)
    const p2wpkh = bitcoin.payments.p2wpkh({
        pubkey: pubKeyBuffer,
        network,
    }).address;

    // P2SH-P2WPKH (Nested SegWit address)
    const p2shP2wpkh = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2wpkh({ pubkey: pubKeyBuffer, network }),
        network,
    }).address;

    // P2TR (Taproot address)
    const p2tr = bitcoin.payments.p2tr({
        internalPubkey: pubKeyBuffer.slice(1),
        network,
    }).address;

    // P2WSH (Pay-to-Witness-Script-Hash)
    const p2wsh = bitcoin.payments.p2wsh({
        redeem: bitcoin.payments.p2pk({ pubkey: pubKeyBuffer, network }),
        network,
    }).address;

    // P2SH (Pay-to-Script-Hash) - Example with P2PK script
    const p2sh = bitcoin.payments.p2sh({
        redeem: bitcoin.payments.p2pk({ pubkey: pubKeyBuffer, network }),
        network,
    }).address;

    return { p2pkh, p2wpkh, p2shP2wpkh, p2tr, p2wsh, p2sh };
}

function cleanArray(dataArray) {
    // Remove rows with empty values
    const cleanedData = dataArray.filter((row) =>
        Object.values(row).every(
            (value) => value !== "" && value !== null && value !== undefined
        )
    );

    // Rename columns
    const renamedData = cleanedData.map((row) => ({
        blockchain: row["blockchain"],
        network: row["network"],
        token_id: row["tokenId"],
        eth_address: row["ethAddress"],
        btcP2PKH: row["p2pkh"],
        btcP2WPKH: row["p2wpkh"],
        btcP2SHP2WPKH: row["p2shP2wpkh"],
        btcP2TR: row["p2tr"],
        btcP2WSH: row["p2wsh"],
        btcP2SH: row["p2sh"],
    }));

    return renamedData;
}

function convertToCSV(data) {
    const headers =
        "Blockchain,Network,Token ID,ETH Address,BTC P2PKH,BTC P2WPKH,BTC P2SHP2WPKH,BTC P2TR,BTC P2WSH,BTC P2SH";
    const rows = data
        .map(
            (row) =>
                `${row.blockchain},${row.network},${row.token_id},${row.eth_address},${row.btcP2PKH},${row.btcP2WPKH},${row.btcP2SHP2WPKH},${row.btcP2TR},${row.btcP2WSH},${row.btcP2SH}`
        )
        .join("\n");
    return `${headers}\n${rows}`;
}

const CSV_DIR = 'csv';

const getFormattedDate = () => {
    const date = new Date();
    return {
        day: date.getDate().toString().padStart(2, '0'),
        month: (date.getMonth() + 1).toString().padStart(2, '0'),
        year: date.getFullYear().toString().slice(-2)
    };
};

function writePkpCSV(_data) {
    if (!fs.existsSync(CSV_DIR)) {
        fs.mkdirSync(CSV_DIR);
        console.log('Created csv directory');
    }
    const { day, month, year } = getFormattedDate();
    
    const fileName = `pkp-${day}-${month}-${year}.csv`;
    const filePath = path.join(CSV_DIR, fileName);
    
    fs.writeFileSync(filePath, _data);
    console.log(`PKP CSV data exported successfully to ${filePath}`);
}

function writeBlockCSV(_data) {
    if (!fs.existsSync(CSV_DIR)) {
        fs.mkdirSync(CSV_DIR);
        console.log('Created csv directory');
    }

    const { day, month, year } = getFormattedDate();
    
    const fileName = `block-${day}-${month}-${year}.csv`;
    const filePath = path.join(CSV_DIR, fileName);
    
    fs.writeFileSync(filePath, _data);
    console.log(`Block CSV data exported successfully to ${filePath}`);
}



async function main() {
    const blockchain = process.env.BLOCKCHAIN;

    const { rpcUrl, chainId } = blockchains[blockchain];
    if (!rpcUrl || !chainId) {
        throw new Error(`Invalid blockchain specified: ${selectedBlockchain}`);
    }
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl, {
        name: blockchain,
        chainId,
    });

    const startBlock = 680086;
    const endBlock = await provider.getBlockNumber();
    const network = process.env.NETWORK || "all";
    // const endBlock = 680086;

    console.log("endBlock: ", endBlock)
    
    const PKPs = await fetchPKPs(
        startBlock,
        endBlock,
        blockchain,
        network,
        provider
    );

    const csv = convertToCSV(PKPs);
    writePkpCSV(csv);
    writeBlockCSV(`start block: ${startBlock.toString()} \nend block: ${endBlock.toString()}`);
}

main()
// 680086