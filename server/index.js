'use strict';
const fs = require('fs');
const csv = require('csv-parse');
const transform = require('stream-transform');

function toTitleCase(str)
{
    return str.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
}

class ZipRecord {
	constructor (zip, city, state) {
		this.zip = zip;
		this.city = toTitleCase(city);
		this.state = state;
	}
	
	toString() { return `${this.city}, ${this.state} ${this.zip}`; }
}

function ZipCodeDb() {
	const byZipCode = {};
	
	this.add = zipRecord => {
		let existing = byZipCode[zipRecord.zip];
		if (existing == null) byZipCode[zipRecord.zip] = existing = [];
		existing.push(zipRecord);
	}
	
	this.findByZip = function(zipCode) {
		return byZipCode[zipCode] || [];
	}
}

function readZipCodeDb(stream) {

	const input = (typeof stream === "string") ? fs.createReadStream(dataFile) : stream;
	const csvParser = csv({delimiter:',', columns:true});
	const db = new ZipCodeDb();
	
	function addCsvRecord(csvRecord) {
		db.add(new ZipRecord(csvRecord.Zipcode, csvRecord.City, csvRecord.State));
	}
	
	const csvTransformer = transform(addCsvRecord, {parallel: 10, consume: true});
	
	return new Promise((resolve,reject)=>{
		const loading = input.pipe(csvParser).pipe(csvTransformer);
		loading.on("finish", ()=>resolve(db));
	});
}

const dataFile = "data/zipcodes.csv";

console.log("loading...");
readZipCodeDb(dataFile).then(db=>{
	console.log(db.findByZip("07405"));
});

