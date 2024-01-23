const express = require('express');
const bodyParser = require('body-parser');
const AWS = require('aws-sdk');
const cors = require('cors');

const winston = require('winston');
const expressWinston = require('express-winston');

const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: 'logs/app.log' })
    ],
});

// Load credentials and set the region from the AWS profile
AWS.config.credentials = new AWS.SharedIniFileCredentials();
AWS.config.update({ region: 'eu-central-1' }); // Replace with your desired region

const dynamodb = new AWS.DynamoDB();
const app = express();


// Request logging
app.use(expressWinston.logger({
    transports: [
        new winston.transports.File({ filename: 'logs/requests.log' })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.json()
    ),
    meta: true, // optional: control whether you want to log the meta data about the request (default to true)
    msg: "HTTP {{req.method}} {{req.url}} {{req.body}}", // optional: customize the default logging message. 
    expressFormat: true, // Use the default Express/morgan request formatting. Enabling this will override any msg if true.
    colorize: false, // Color the text and status code, good for development
    ignoreRoute: function (req, res) { return false; } // optional: allows to skip some log messages based on request and/or response
}));

// Enable CORS for all routes and origins
app.use(cors());

app.use(bodyParser.json());

app.post('/submit-query', async (req, res) => {
    logger.info('This is an info log message');
    
    try {
        let { query, maxPageSize } = req.body;
        let params = {
            Statement: query,
            Parameters: null,
            NextToken: null,
            Limit: 1000
        };
        let results = [];
        let items;
        let currentPageSize = 0; // Initialize current page size to 0

        maxPageSize = parseInt(maxPageSize || 10); // Set the maximum page size to 100

        logger.info(`Query: ${query}`);

        do {
            items = await dynamodb.executeStatement(params).promise();
            results.push(...items.Items.map(i => convertDynamoDBItemToJSObject(i)));

            params.NextToken = items.NextToken;
            currentPageSize += 1;
        } while (typeof items.NextToken != "undefined" && currentPageSize <= maxPageSize);

        res.json(results);

        logger.info(`Query produced results: ${results.length}`);
    } catch (error) {
        const message = handleExecuteStatementError(error);

        console.error(message);

        logger.error(`Error occurred during query.\r\n${message}`);

        res.status(500).json({ message });
    }
});

function convertDynamoDBItemToJSObject(item) {
    const result = {};
    for (const key in item) {
        if (item.hasOwnProperty(key)) {
            const value = item[key];
            if (typeof value === 'object' && value !== null) {
                const type = Object.keys(value)[0]; // Get the type key (S, N, M, etc.)
                if (type === 'M') {
                    // Recursively process maps
                    result[key] = convertDynamoDBItemToJSObject(value[type]);
                } else {
                    // Directly assign the value for other types
                    result[key] = value[type];
                }
            }
        }
    }
    return result;
}


// Handles errors during ExecuteStatement execution. Use recommendations in error messages below to 
// add error handling specific to your application use-case. 
function handleExecuteStatementError(err) {
    if (!err) {
        return 'Encountered error object was empty';
    }
    if (!err.code) {
        return `An exception occurred, investigate and configure retry strategy. Error: ${JSON.stringify(err)}`;
    }
    switch (err.code) {
        case 'ConditionalCheckFailedException':
            return `Condition check specified in the operation failed, review and update the condition check before retrying. Error: ${err.message}`;
        case 'TransactionConflictException':
            return `Operation was rejected because there is an ongoing transaction for the item, generally safe to retry ' +
         'with exponential back-off. Error: ${err.message}`;
        case 'ItemCollectionSizeLimitExceededException':
            return `An item collection is too large, you're using Local Secondary Index and exceeded size limit of` +
                `items per partition key. Consider using Global Secondary Index instead. Error: ${err.message}`;
        default:
            break;
        // Common DynamoDB API errors are handled below
    }

    return handleCommonErrors(err);
}

function handleCommonErrors(err) {
    switch (err.code) {
        case 'InternalServerError':
            return `Internal Server Error, generally safe to retry with exponential back-off. Error: ${err.message}`;
        case 'ProvisionedThroughputExceededException':
            return `Request rate is too high. If you're using a custom retry strategy make sure to retry with exponential back-off. `
                + `Otherwise consider reducing frequency of requests or increasing provisioned capacity for your table or secondary index. Error: ${err.message}`;
        case 'ResourceNotFoundException':
            return `One of the tables was not found, verify table exists before retrying. Error: ${err.message}`;
        case 'ServiceUnavailable':
            return `Had trouble reaching DynamoDB. generally safe to retry with exponential back-off. Error: ${err.message}`;
        case 'ThrottlingException':
            return `Request denied due to throttling, generally safe to retry with exponential back-off. Error: ${err.message}`;
        case 'UnrecognizedClientException':
            return `The request signature is incorrect most likely due to an invalid AWS access key ID or secret key, fix before retrying. `
                + `Error: ${err.message}`;
        case 'ValidationException':
            return `The input fails to satisfy the constraints specified by DynamoDB, `
                + `fix input before retrying. Error: ${err.message}`;
        case 'RequestLimitExceeded':
            return `Throughput exceeds the current throughput limit for your account, `
                + `increase account level throughput before retrying. Error: ${err.message}`;
        default:
            return `An exception occurred, investigate and configure retry strategy. Error: ${err.message}`;
    }
}


const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
