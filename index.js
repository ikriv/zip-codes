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

function ZipCodeDb(stream) {
	const byZipCode = {};
	
	const input = (typeof stream === "string") ? fs.createReadStream(dataFile) : stream;
	const csvParser = csv({delimiter:',', columns:true});
	
	function addRecord(record) {
		const obj = new ZipRecord(record.Zipcode, record.City, record.State);
		let existing = byZipCode[obj.zip];
		if (existing == null) byZipCode[obj.zip] = existing = [];
		existing.push(obj);
	}
	
	const csvTransformer = transform(addRecord, {parallel: 10, consume: true});
	const readyPromise = new Promise((resolve,reject)=>{
		const loading = input.pipe(csvParser).pipe(csvTransformer);
		loading.on("finish", ()=>resolve(this));
	});
	
	this.ready = function(callback) {
		readyPromise.then(db=>callback(db));
	}

	this.findByZip = function(zipCode) {
		return byZipCode[zipCode] || [];
	}
}


const dataFile = "data/zipcodes.csv";

console.log("loading...");
new ZipCodeDb(dataFile).ready(db=>{
	console.log(db.findByZip("07405"));
});

