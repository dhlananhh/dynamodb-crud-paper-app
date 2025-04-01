require('dotenv').config(); // load enviroment variables first
const express = require('express');
const AWS = require('aws-sdk');
// require('aws-sdk/lib/maintenance_node_message').suppress = true;
// suprress sdk update messages if needed

// --- AWS Configuration ---
AWS.config.update({
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
	region: process.env.REGION,
})

// Initialize DynamoDB DocumentClient for easier JSON handling
const docClient = new AWS.DynamoDB.DocumentClient();
const tableName = process.env.DYNAMODB_TABLE_NAME;

// --- Express App Setup ---
const app = express();
const PORT = process.env.PORT || 5000;

// --- Middleware ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static('views'));

// --- View Engine Setup ---
app.set('view engine', 'ejs');
app.set('views', './views');

// --- Routes ---
/**
 * READ ALL Papers (GET /)
 * Fetches all items from the DynamoDB table and renders the index page.
 */
app.get('/', async (req, res) => {
	const params = {
		TableName: tableName,
	};

	try {
		const data = await docClient.scan(params).promise();
		console.log('Successfully scanned papers: ', JSON.stringify(data.Items, null, 2));
		res.render('index', { papers: data.Items || [] }); // pass empty array if no items
	} catch (err) {
		console.error('Error scanning papers: ', JSON.stringify(err, null, 2));
		res.status(500).send('Internal Server Error: Could not fetch papers.')
	}
});

/**
 * CREATE Paper (POST /add)
 * Adds a new paper item to the DynamoDB table.
 */

app.post('/add', async (req, res) => {
	// extract data from form submission
	const { paper_id, paper_name, authors, isbn, page_number, publish_year } = req.body;

	// basic validation
	if (!paper_id || !paper_name || !authors || !isbn || !page_number || !publish_year ) {
		return res.status(400).send('Bad request: All fields are required.');
	}

	const params = {
		TableName: tableName,
		Item: {
			paper_id: Number(paper_id),
			paper_name: paper_name,
			authors: authors,
			isbn: isbn,
			page_number: Number(page_number),
			publish_year: Number(publish_year),
		}
	};

	try {
		await docClient.put(params).promise();
		console.log(`Successfully added paper with ID: ${paper_id}`);
		res.redirect('/'); // redirect back to the main page
	} catch (err) {
		console.error(`Error adding paper with ID ${paper_id}`, JSON.stringify(err, null, 2));
		res.status(500).send(`Internal Server Error: Could not add paper.`);
	}
})

/**
 * SHOW Update Form (GET /update/:id)
 * Fetches a single paper by ID and renders the update form with pre-filled data.
 */
app.get('/update/:paper_id', async (req, res) => {
	const id = Number(req.params.paper_id);

	if (isNaN(id)) {
		return res.status(500).send('Invalid Paper ID');
	};

	const params = {
		TableName: tableName,
		Key: {
			paper_id: id,
		},
	};

	try {
		const data = await docClient.get(params).promise();
		if (!data.Item) {
			console.log(`Paper with ID ${id} not found for update.`);
			return res.status(404).send('Paper not found.');
		}
		console.log(`Rendering update form for paper ID: ${id}`);
		res.render('update', { paper: data.Item }) // pass paper data to the update view
	} catch (err) {
		console.error(`Error fetching paper ${id} for update: `, JSON.stringify(err, null, 2));
		res.status(500).send('Internal Server Error: Could not fetch paper details.')
	}
})

/**
 * DELETE Paper (POST /delete)
 * Deletes a paper item from the DynamoDB table based on ID.
 */
app.post('/delete', async (req, res) => {
	const { paper_id } = req.body;

	// basic validation
	if (!paper_id) {
		console.warn('Attempted to delete without providing an ID.');
		return res.redirect('/');
	}

	const params = {
		TableName: tableName,
		Key: {
			paper_id: Number(paper_id),
		}
	};

	try {
		await docClient.delete(params).promise();
		console.log(`Successfully deleted paper with ID: ${paper_id}`);
		res.redirect('/');
	} catch (err) {
		console.error(`Error deleteing course with ID ${paper_id}`, JSON.stringify(err, null, 2));
		res.status(500).send('Internal Server Error: Could not delete paper.');
	}
});

// --- start server ---
app.listen(PORT, () => {
	console.log(`Server is running on http://localhost:${PORT}`);
})
