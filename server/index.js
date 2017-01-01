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
	const byState = {};
	
	this.add = zipRecord => {
		function addByZipCode(zipRecord) {
			let existing = byZipCode[zipRecord.zip];
			if (existing == null) byZipCode[zipRecord.zip] = existing = [];
			existing.push(zipRecord);
		}	
		
		function addByName(zipRecord) {
			const name = zipRecord.city;
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

			function ensureState(state) {
				var state = state.toLowerCase();
				var result = byState[state];
				if (result == null) result = byState[state] = {};
				return result;
			}

			var root = ensureState(zipRecord.state);
			addByNameImpl(root, 0);
		}
		
		addByZipCode(zipRecord);
		addByName(zipRecord);
	}
	
	this.findByZip = function(zipCode) {
		return byZipCode[zipCode] || [];
	}
	
	this.findByName = function(name, searchState, maxMatches) {
		
		function getProps(obj, maxPropNameLength) {
			var props = [];
			for (let prop in obj) {
				if (!obj.hasOwnProperty(prop)) continue;
				if (prop.length > maxPropNameLength) continue;
				props.push(prop);
			}
			props.sort();
			return props;
		}
		
		var result = [];
		
		function addChildrenOf(node) {
			if (node.match != null) {
				result.push(node.match);
				if (result.length >= maxMatches) return false;
			}
			
			for (let c of getProps(node, 1)) {
				if (!addChildrenOf(node[c])) return false;
			}
			
			return true;
		}
		
		function getStartNode(state) {
			let node = byState[state];
			if (node == null) return null;
			
			for (let c of name) {
				node = node[c];	
				if (node == null) return null;
			}
			
			return node;
		}
		
		function getStates() {
			if (searchState != null) return [searchState.toLowerCase()];
			return getProps(byState, 2);
		}
		
		name = name.toLowerCase();
		
		for (let state of getStates()) {
			var start = getStartNode(state);
			if (start == null) continue;
			if (!addChildrenOf(start)) break;
		}
		
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
	
	print(db.findByName("But", "NJ", 10));
	console.log("--");
	print(db.findByName("But", null, 10));
})
.catch(err=> {
	console.log(err);
});


var db = new ZipCodeDb();
db.add(new ZipRecord("07405", "Butler", "NJ"));
db.add(new ZipRecord("12345", "Butler", "PA"));
db.add(new ZipRecord("33333", "Buchanan", "GA"));
db.add(new ZipRecord("33334", "Buchanan", "GA"));

print(db.findByName("b", "PA", 3));
console.log("--");
print(db.findByName("b", null, 10));

