'use strict';
const fs = require('fs');
const csv = require('csv-parse');
const transform = require('stream-transform');

function print(obj) {
	const util = require('util');
	console.log(util.inspect(obj, {showHidden:false, depth:null}));
}

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
	const byName = {};
	
	function addByZipCode(zipRecord) {
		let existing = byZipCode[zipRecord.zip];
		if (existing == null) byZipCode[zipRecord.zip] = existing = [];
		existing.push(zipRecord);
	}	

	function addByName(zipRecord) {
		const name = zipRecord.city + ", " + zipRecord.state; // e.g. "Philadelphia, PA"
		const len = name.length;
		
		function addByNameImpl(node, charIndex) {
			if (charIndex >= len) {
				if (node.match == null) node.match = { name, records: [] };
				node.match.records.push(zipRecord);
				return;
			}
			
			const c = name.charAt(charIndex).toLowerCase();
		    let child = node[c];
			if (child == null) child = node[c] = {};
			addByNameImpl(child, charIndex+1);
		}
		
		addByNameImpl(byName, 0);
	}
	
	this.add = zipRecord => {
		addByZipCode(zipRecord);
		addByName(zipRecord);
	}
	
	this.findByZip = function(zipCode) {
		return byZipCode[zipCode] || [];
	}
	
	this.findByName = function(name, maxMatches) {
		var start = byName;
		name = name.toLowerCase();
		
		for (let c of name) {
			start = start[c];	
			if (start == null) return [];
		}
		
		var result = [];
		
		function addChildrenOf(node) {
			if (node.match != null) {
				result.push(node.match);
				if (result.length >= maxMatches) return false;
			}
			
			for (let prop in node) {
				if (!node.hasOwnProperty(prop)) continue;
				if (prop.length > 1) continue;
				if (!addChildrenOf(node[prop])) return false;
			}
			
			return true;
		}
		
		addChildrenOf(start);
		
		return result;
	}
}

function readZipCodeDbFromCsv(stream) {

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
readZipCodeDbFromCsv(dataFile).then(db=>{
	console.log(db.findByZip("07405"));
	
	var butler = db.findByName("Butler", 10);
	print(butler);
});

/*
var db = new ZipCodeDb();
db.add(new ZipRecord("07405", "Butler", "NJ"));
db.add(new ZipRecord("12345", "Butler", "PA"));
db.add(new ZipRecord("33333", "Buchanan", "GA"));
db.add(new ZipRecord("33334", "Buchanan", "GA"));

var result = db.findByName("b", 3);
print(result);
*/

