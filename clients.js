const fs = require('fs');
require('dotenv').config();
const { program } = require('commander');
const config = require('./config');
const { MoMUMapper } = require("./parsers/momuMapper");
const { initializeSupabase } = require("./parsers/database");

async function main() {
    try {
        // Parse command line arguments first
        program
            .version('0.1.0')
            .description('CLI for CHAI-T, adding new data')
            .requiredOption('-f, --file <path>', 'Path to the input file')
            .requiredOption('-o, --org <organization>',
                `Organization (${config.organizations.valid.join(', ')})`)
            .parse();

        const options = program.opts();

        // Validate organization
        if (!config.organizations.valid.includes(options.org.toUpperCase())) {
            throw new Error(
                `Invalid organization. Must be one of: ${config.organizations.valid.join(', ')}`
            );
        }

        // Initialize database connection
        console.log('Initializing database connection...');
        const dbInitialized = await initializeSupabase();
        if (!dbInitialized) {
            throw new Error('Failed to initialize database connection');
        }

        // Continue with file processing
        if (!fs.existsSync(options.file)) {
            throw new Error(`File not found: ${options.file}`);
        }

        const rawData = fs.readFileSync(options.file, 'utf-8');
        const data = JSON.parse(rawData);

        if (options.org.toUpperCase() === 'MOMU') {
            const result = await MoMUMapper(data);
            console.log('\nFinal Summary:', JSON.stringify(result, null, 2));

            if (result.failed > 0) {
                process.exit(1);
            }
        }

    } catch (error) {
        console.error('Fatal error:', {
            message: error.message,
            stack: error.stack
        });
        process.exit(1);
    }
}

// Add proper signal handling
process.on('SIGINT', () => {
    console.log('\nGracefully shutting down...');
    process.exit(0);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main().catch(error => {
    console.error('Unhandled error:', error.message);
    process.exit(1);
});