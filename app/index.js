const express = require('express');
const bodyParser = require('body-parser');
const https = require('https');
const http = require('http');
const bluebird = require('bluebird');
const querystring = require('querystring');

const c4chost = 'my302398.crm.ondemand.com';
const host = 'api.worldweatheronline.com';
const wwoApiKey = '4298d5327cf044b1a7891635202901';

const app = express(); 
const port = 443;
app.use(bodyParser.json()); 

app.post('/updatename', (req, res) => {
  //console.log(req.body);
  var statuscode = [];
  var convmemory = req.body.conversation.memory;
  convmemory.accountname = req.body.nlp.source;
  //console.log('memory is ' + JSON.stringify(convmemory));
  
  let c4cpath = '/sap/c4c/odata/cust/v1/zqueryticket/ServiceRequestServiceRequestLifeCycleStatusCodeCollection?$format=json';
  var p = new bluebird(function(resolve, reject) {
		// Create the path for the HTTP request to get the weather
		//  console.log('API Request: ' + newc4cfullpath);
		
		var options = {
						host: c4chost,
						path: c4cpath,
						// authentication headers
						headers: {
							'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
					}
		};
			
		https.get(options , (res) => {
			let body = ''; // var to store the response chunks   
			let output = ''; 
			res.on('data', (d) => { body += d;}); // store each response chunk
			res.on('end', () => {
				// After all the data has been received parse the JSON for desired data
				console.log(body);
				let response = JSON.parse(body);
				let codes = response.d.results;				
				for(var item of codes){
					let code = { code: item.Code , desc: item.Description };
					statuscode.push(code);
				}
				console.log('Status - ' + statuscode.toString());
				resolve('Status codes downladed');
				convmemory.statuscode = statuscode;
			});
			res.on('error', (error) => {
				console.log(`Cannot reach server!`);
				reject(`Cannot reach server!`);
			});
		}); 
		
	});   
		
	return new Promise((resolve, reject) => {
		var allpromises = [p];        
		bluebird.all(allpromises.map(function(pr) {  return pr.reflect();   })).each(function(inspection) {
			if (inspection.isFulfilled()) {
				console.log("A promise in the array was fulfilled with", inspection.value());
				res.send({
					replies: [{
					  type: 'text',
					  content: 'Please enter customer postal code for verification',
					}], 
					conversation: {
					  memory: convmemory
					}
				  });
				resolve(inspection.value());				
			} else {
				console.error("A promise in the array was rejected with", inspection.reason());
				reject(inspection.reason());
				res.send({
					replies: [{
					  type: 'text',
					  content: 'Please enter customer postal code for verification',
					}], 
					conversation: {
					  memory: convmemory
					}
				  });
			}
		});        
	});

     
});


app.post('/verifyuser', (req, res) => {
	
	var memory = req.body.conversation.memory;
	const accid = memory.accountid.value;
	const accname = memory.accountname.toString().toLowerCase();;
	const acccode = req.body.nlp.source.toString().replace(/ +/g, "").toLowerCase();
	console.log('memory is ' + JSON.stringify(memory));
	console.log('accid ' + accid);
	console.log('name ' + accname);
	console.log('code ' + acccode);
  
    let c4cpath = '/sap/c4c/odata/cust/v1/zquerycustomer/CustomerCollection?$format=json&$filter=InternalID%20eq%20%27*'+ encodeURIComponent(accid) +'%27';
    console.log('c4cpath ' + c4cpath);
    var options = {
							host: c4chost,
							path: c4cpath,
							// authentication headers
							headers: {
								'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
							}
						};
	
	var p = new bluebird(function(resolve, reject) {
		// Make the HTTPS request to get the account from C4C
		https.get(options , (res) => {
			let body = ''; // var to store the response chunks   
			let output = ''; 
			res.on('data', (d) => { body += d;}); // store each response chunk
			res.on('end', () => {
					// After all the data has been received parse the JSON for desired data
					console.log(body);
					let response = JSON.parse(body);
					let accounts = response.d.results;
					let ind = -1;
					var matchedaccount = accounts.find(function(item, i){                      
					  if(item && item.Name && item.PostalCode) {
						let c4cname = item.Name.toString().toLowerCase();
						let c4czipcode = item.PostalCode.toString().replace(/ +/g, "").toLowerCase();
						if (c4cname == accname && c4czipcode == acccode){ ind = i; return i; }
					  }
					});
					
					if (ind == -1)
					{ 		
							output = 'Sorry the validation has failed!! Please start over!';							
							reject(output);		
							memory = {verified: "false", status: "Input Complete"}							
							
					}
					else
					{
							console.log('matchedaccount ' + accounts[ind].InternalID );
							// Create response
							output = `Account verified. Thank you !`;
							memory.verified = "true";
							resolve(output);
							
					} 	
			});
			res.on('error', (error) => {
				console.log(`Cannot reach server!`);
				reject(`Cannot reach server!`);
			});
		});
	});
	return new Promise((resolve, reject) => {
		var allpromises = [p];        
		bluebird.all(allpromises.map(function(pr) {  return pr.reflect();   })).each(function(inspection) {
			if (inspection.isFulfilled()) {
				console.log("A promise in the array was fulfilled with", inspection.value());
				resolve(inspection.value());
				res.send({
					replies: [{
					  type: 'text',
					  content: inspection.value(),
					}],
					conversation: {
					  memory: memory
					}
				  });
			} else {
				console.error("A promise in the array was rejected with", inspection.reason());
				res.send({
					replies: [{
					  type: 'text',
					  content: inspection.reason(),
					}],
					conversation: {
					  memory: {verified: "false", status: "Input Complete"}
					}
				  });
				reject(inspection.reason());
			}
		});        
	});

  
});


app.post('/gettickets', (req, res) => {
	
	var memory = req.body.conversation.memory;
	const accid = memory.accountid.value;
	console.log('memory is ' + JSON.stringify(memory));
	console.log('accid ' + accid);
	
	let c4cpath = '/sap/c4c/odata/cust/v1/zqueryticket/ServiceRequestCollection?$filter=PartyID%20eq%20%27'+ encodeURIComponent(accid) +'%27%20and%20ServiceRequestLifeCycleStatusCode%20ne%20%273%27&$format=json';
    console.log('c4cpath ' + c4cpath);
	
	return new Promise((resolve, reject) => {
        // Create the path for the HTTP request to get the weather
        const options = {
                       host: c4chost,
                       path: c4cpath,
                       // authentication headers
                       headers: {
                          'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
                       }
                    };
        // Make the HTTPS request to get the account from C4C
        https.get(options , (httpres) => {
          let body = ''; // var to store the response chunks    
          httpres.on('data', (d) => { body += d;}); // store each response chunk
          httpres.on('end', () => {
            // After all the data has been received parse the JSON for desired data
            console.log(body);
            let response = JSON.parse(body);            
			let output = '';
			if(response.d.results.length > 0) {
				
				output = `Here are the list of open Tickets`;
				let tickets = [];
				// Resolve the promise with the output text
				console.log(output);
				resolve(output);				
				for(var item of response.d.results){
					//let ticketitem = { title: '#' + item.ID + ': ' + item.Name, value: 'Ticket#'+item.ID ,  };
					let ticketitem = { title: item.ID , subtitle: item.Name, buttons: [{ title: 'View Ticket', value: 'Ticket#'+item.ID }]};
					tickets.push(ticketitem);
				}
				res.send({
					replies: [{
					  type: 'list',					  
					  content: { 
						elements: tickets,
					  }
					}],
					conversation: {
					  memory: memory
					}
				  });
				
			}
			else {
                        
				output = `No open tickets found!`;
				res.send({
					replies: [{
					  type: 'quickReplies',
					  content: { 
						title: output,
						buttons: [{ title: 'Create a New Ticket', value: 'Create a New Ticket' } , { title: 'Existing Tickets', value: 'Existing Tickets' }
						, { title: 'Bye', value: 'Bye' }],
					  }
					}],
					conversation: {
					  memory: memory
					}
				  });
				// Resolve the promise with the output text
				console.log(output);
				resolve(output);				
			}
          });
          httpres.on('error', (error) => {
            console.log(`No Ticket with this ID exists in C4C !`);
            reject();
          });
        });     
    });

	
});	



app.post('/ticketwithid', (req, res) => {
	
	var memory = req.body.conversation.memory;
	const accid = memory.accountid.value;
	var str = req.body.nlp.source;
	let tktid = str.substr(str.indexOf('#')+1, 10);
	console.log('memory is ' + JSON.stringify(memory));
	console.log('tktid ' + tktid);
	
	let c4cpath = '/sap/c4c/odata/cust/v1/zqueryticket/ServiceRequestCollection?$filter=PartyID%20eq%20%27'+ encodeURIComponent(accid) +'%27%20and%20ID%20eq%20%27'+ encodeURIComponent(tktid) +'%27&$format=json';
    console.log('c4cpath ' + c4cpath);
	
	//return new Promise((resolve, reject) => {
	var p = new bluebird( function(resolve, reject) {
        // Create the path for the HTTP request to get the weather
        var options = {
                       host: c4chost,
                       path: c4cpath,
                       // authentication headers
                       headers: {
                          'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
                       }
                    };
        // Make the HTTPS request to get the account from C4C
        https.get(options , (httpres) => {
          let body = ''; // var to store the response chunks    
          httpres.on('data', (d) => { body += d;}); // store each response chunk
          httpres.on('end', () => {
            // After all the data has been received parse the JSON for desired data
            console.log(body);
            let response = JSON.parse(body);            
			let output = '';
			if(response.d.results.length > 0) {
				
				let tickets = response.d.results[0];				
				var status = '';					
				for(var item of memory.statuscode){
					if(item.code == tickets.ServiceRequestLifeCycleStatusCode)			
					{ status = item.desc; break; }
				}
				// GET THE PRODUCT
				c4cpath = '/sap/byd/odata/cust/v1/zqueryticket/ServiceRequestServiceReferenceObjectCollection?$filter=ParentObjectID%20eq%20%27'+ encodeURIComponent(tickets.ObjectID) +'%27&$format=json';
				options = {
                       host: c4chost,
                       path: c4cpath,
                       // authentication headers
                       headers: {
                          'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
                       }
                    };
				// Make the HTTPS request to get the account from C4C
				https.get(options , (prodres) => {
				  body = ''; // var to store the response chunks    
				  prodres.on('data', (d) => { body += d;}); // store each response chunk
				  prodres.on('end', () => {
					// After all the data has been received parse the JSON for desired data
					console.log(body);					
					response = JSON.parse(body);					
					if(response.d.results.length > 0) {
						let prods = response.d.results[0];
						res.send({
							replies: [{
							  type: 'card',
							  content: {
								  title: `${tickets.Name}, Status: ${status}`,
								  subtitle: `Due by: ${tickets.DateTime.substr(0,10)}
Prod: ${prods.Description}, #:${prods.SerialID}`,
								  imageurl: 'https://cdn.recast.ai/webchat/bot.png',
								  buttons: [{ title: 'Create a New Ticket', value: 'Create a New Ticket' } , { title: 'Existing Tickets', value: 'Existing Tickets' }
								  , { title: 'Bye', value: 'Bye' }],
							  }
							}],
							conversation: {
							  memory: memory
							}
						  });
						resolve('Found Ticket');
						
					}
					else {
						console.log('ticket without products');
						res.send({
							replies: [{
							  type: 'card',
							  content: {
								  title: `${tickets.Name}`,
								  subtitle: `Status: ${status}
Due by: ${tickets.DateTime.substr(0,10)}`,
								  imageurl: 'https://cdn.recast.ai/webchat/bot.png',
								  buttons: [{ title: 'Create a New Ticket', value: 'Create a New Ticket' } , { title: 'Existing Tickets', value: 'Existing Tickets' }
								  , { title: 'Bye', value: 'Bye' }],
							  }
							}],
							conversation: {
							  memory: memory
							}
						  });
						resolve('Found Ticket');
					}
				  });
				  prodres.on('error', (error) => {
					console.log(`No Ticket with this ID exists in C4C !`);
					reject();
				  });
				}); 
			}
			else {
                        
				output = `No ticket with ID ${tktid} found in SAP!`;
				res.send({
					replies: [{
					  type: 'buttons',
					  content: { 
						title: output,
						buttons: [{ title: 'Create a New Ticket', value: 'Create a New Ticket' } , { title: 'Existing Tickets', value: 'Existing Tickets' }
						, { title: 'Bye', value: 'Bye' }],
					  }
					}],
					conversation: {
					  memory: memory
					}
				  });
				// Resolve the promise with the output text
				console.log(output);
				resolve(output);				
			}
          });
          httpres.on('error', (error) => {
            console.log(`No Ticket with this ID exists in C4C !`);
            reject();
          });
        });     
    });
	
	return new Promise((resolve, reject) => {
		var allpromises = [p];   		
		bluebird.all(allpromises.map(function(pr) {  return pr.reflect();   })).each(function(inspection) {
			if (inspection.isFulfilled()) {
				console.log("A promise in the array was fulfilled with", inspection.value());
				resolve(inspection.value());								
			} else {
				console.error("A promise in the array was rejected with", inspection.reason());
				reject(inspection.reason());
				res.send({
					replies: [{
					  type: 'buttons',
					  content: { 
						title: 'ERROR while retrieving data !!',
						buttons: [{ title: 'Create a New Ticket', value: 'Create a New Ticket' } , { title: 'Existing Tickets', value: 'Existing Tickets' }
						, { title: 'Bye', value: 'Bye' }],
					  }
					}],
					conversation: {
					  memory: memory
					}
				  });	
			}
		});        
	});
	
	
});	


app.post('/newticket', (req, res) => {
	
	var memory = req.body.conversation.memory;
	const accid = memory.accountid.value;
	
	if (memory.status == "waiting for reg products")
	{	
		if(isNaN(req.body.nlp.source)) {
			memory.productid = 'UNSPECIFIED';			
		}
		else {
			memory.productid = req.body.nlp.source;			
		}
		res.send({
			replies: [{
			  type: 'text',
			  content: 'Thanks. Please enter a ticket description'
			}],
			conversation: {
			  memory: memory
			}
		  });
		return;
	}
	
		
	let c4cpath = '/sap/c4c/odata/cust/v1/zqueryticket/ServiceRequestCollection';

	var p = new bluebird( function(resolve, reject) {
		// Create the path for the HTTP request to get the weather
		const postData = JSON.stringify({   
			Name: req.body.nlp.source,
			PartyID: accid.toString()
		});
		const token_options = 
						{
							host: c4chost,
							path: c4cpath,
							headers: {
							  'x-csrf-token' : 'fetch',
							  'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
							}
						};
		
		var csrf = '';
		var output = 'Default message';
		var req_sent = 0;        
		https.get(token_options , (res) => {
		  
		  let body = ''; // var to store the response chunks
		  res.on('data', (d) => { body += d;}); // store each response chunk
		  res.on('end', () => {
			csrf = res.headers['x-csrf-token']; 
			var cookie = res.headers['set-cookie'];
						
			var options = {
					   host: c4chost,
					   path: c4cpath,
					   method: 'POST',
					   // authentication headers
					   headers: {
						  'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64'),
						  'Content-Type': 'application/json', //x-www-form-urlencoded',
						  'Accept': 'application/json',
						  //'Content-Length': postData.length,
						  'x-csrf-token': csrf,
						  'Cookie': cookie
					   },
					   json: true,
					};
				
				// Make the HTTPS request to get the account from C4C
				var reqp = https.request(options , (res) => {                 
				  
				  res.setEncoding('utf8');
				  
				  let body = ''; // var to store the response chunks    
				  res.on('data', (d) => { body += d; }); // store each response chunk
				  res.on('end', () => {
					// After all the data has been received parse the JSON for desired data
					//const body = xml2json.toJson(body, { object: true });
					console.log('BODY -' + body);
					let response = JSON.parse(body);
					let ticket = response.d.results;
					let Name = ticket.Name;
					//let Status = ticket.ServiceRequestLifeCycleStatusCode;
					let ID = ticket.ID;
					// Create response
					output = `Success! Ticket created with ID ${ID} and Descripton '${Name}' and estimated completion of ${ticket.DateTime.substr(0,10)} !`;
					// Resolve the promise with the output text                    					
					console.log(output);
					if (memory.productid == 'UNSPECIFIED') {
						resolve(output);
					
					}
					else {
						const prodData = JSON.stringify({   
							ParentObjectID: ticket.ObjectID.toString(),
							InstallationPointID: memory.productid.toString()
						});
						c4cpath = '/sap/byd/odata/cust/v1/zqueryticket/ServiceRequestServiceReferenceObjectCollection';
						options = {
						   host: c4chost,
						   path: c4cpath,
						   method: 'POST',
						   // authentication headers
						   headers: {
							  'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64'),
							  'Content-Type': 'application/json', //x-www-form-urlencoded',
							  'Accept': 'application/json',
							  //'Content-Length': postData.length,
							  'x-csrf-token': csrf,
							  'Cookie': cookie
						   },
						   json: true,
						};
						var reqs = https.request(options , (res) => {                 
					  
							res.setEncoding('utf8');
							  
							let body = ''; // var to store the response chunks    
							res.on('data', (d) => { body += d; }); // store each response chunk
							res.on('end', () => {							
								resolve(output);               
							});
							res.on('error', (error) => {
								console.log(`Could not create Ticket ! `);
								reject();
							});
							
						});
						
						// req error
						reqs.on('error', function (err) {
						  console.log('HTTP request to post new data failed');
						  reject();
						});
						reqs.write(prodData);
						reqs.end();  
					}
				  });
				  res.on('error', (error) => {
					console.log(`Could not create Ticket ! `);
					reject();
			      });
					
				 
				  
				});
				
				// req error
				reqp.on('error', function (err) {
				  console.log('HTTP request to post new data failed');
				  reject();
				});
				reqp.write(postData);
				reqp.end();                
									  
			});
		  res.on('error', (error) => {            
			reject('HTTP request to get token failed');
			});
		});      
	   
		
	});
			
	//while(resolved == 0) { console.log('waiting');  }
	//var pr = p.reflect();

	//then(function(data) {
	//           console.log('Response - ' + data );
	 //   }).catch(function(err){
	 //           console.log('Error - ' + err);
	//});     
	return new Promise((resolve, reject) => {
		var allpromises = [p];   		
		bluebird.all(allpromises.map(function(pr) {  return pr.reflect();   })).each(function(inspection) {
			if (inspection.isFulfilled()) {
				console.log("A promise in the array was fulfilled with", inspection.value());
				resolve(inspection.value());				
				res.send({
					replies: [{
					  type: 'text',
					  content: inspection.value()
					}],
					conversation: {
					  memory: memory
					}
				  });
			} else {
				console.error("A promise in the array was rejected with", inspection.reason());
				reject(inspection.reason());				
				res.send({
					replies: [{
					  type: 'text',
					  content: inspection.reason()
					}],
					conversation: {
					  memory: memory
					}
				  });
			}
		});        
	});

	
});		


app.post('/getregisteredproducts', (req, res) => {
	
	var memory = req.body.conversation.memory;
	const accid = memory.accountid.value;
	let output = ''; 
	let regprods = [];
	let regprodsquery = [];
	let productsearchquery = '';
	if (memory.status == "waiting for prod query")
	{	
		if(req.body.nlp.source != "Continue") {
			productsearchquery = req.body.nlp.source.toLowerCase(); }			
		else {
			productsearchquery = 'UNSPECIFIED'; }		
	}

	
	let c4cpath = '/sap/c4c/odata/cust/v1/zquerycustomer/CustomerCollection?$format=json&$filter=InternalID%20eq%20%27*'+ encodeURIComponent(accid) +'%27';
		
    console.log('c4cpath ' + c4cpath);
    var options = {
							host: c4chost,
							path: c4cpath,
							// authentication headers
							headers: {
								'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')
							}
						};
	
	var p = new bluebird(function(resolve, reject) {
		// Make the HTTPS request to get the account from C4C
		https.get(options , (accres) => {
			let body = ''; // var to store the response chunks   			
			accres.on('data', (d) => { body += d;}); // store each response chunk
			accres.on('end', () => {
				// After all the data has been received parse the JSON for desired data
				console.log(body);
				let response = JSON.parse(body);
				let accounts = response.d.results[0];
				let uuid = accounts.UUID;
				c4cpath = '/sap/byd/odata/cust/v1/zqueryregprods/InstallationPointCollection?$format=json&$filter=RoleCode%20eq%20%2760%27'; 
				
				options = {
				   host: c4chost,
				   path: c4cpath,
				   // authentication headers
				   headers: {
					  'Authorization': 'Basic ' + new Buffer('CHATBOT:Mybot@123').toString('base64')						  
				   }
				};
				body = '';
				// Make the HTTPS request to get the account from C4C
				https.get(options , (httpres) => {                 
				  				  
				  httpres.on('data', (d) => { body += d; }); // store each response chunk
				  httpres.on('end', () => {
					// After all the data has been received parse the JSON for desired data
					//const body = xml2json.toJson(body, { object: true });
					console.log('BODY -' + body);
					response = JSON.parse(body);            					
					if(response.d.results.length > 0) {
						console.log('Product search query is ' + productsearchquery);						
						for(var item of response.d.results){
							//let ticketitem = { title: '#' + item.ID + ': ' + item.Name, value: 'Ticket#'+item.ID ,  };
							if (uuid == item.PartyUUID ) {
								let regproditem = { title: item.Description , subtitle: item.SerialID, buttons: [{ title: 'Select', value: item.ID }]};
								regprods.push(regproditem);
								if(productsearchquery != 'UNSPECIFIED') {
									let itemdesc = item.Description.toLowerCase();
									if(itemdesc.includes(productsearchquery)) {
										regprodsquery.push(regproditem); }
								}
							}
						}
						if(regprodsquery.length > 0) {
							output = `Please select your product`; 							
						}
						else {									
							output = `No products found for the search text. Select from all products.`;  
						}
						// Resolve the promise with the output text
						resolve(output);										
						
					}
					else {
						output = `No registered products found!`; 
						// Resolve the promise with the output text
						console.log(output);
						reject(output);														
						
					}
					
					});
				  httpres.on('error', (error) => {
					console.log(`Could not create Ticket ! `);
					reject();
					});
					
				 
				  
				});
				
				
									  
			});
		    accres.on('error', (error) => {            
				reject('HTTP request to get token failed');
			});
		});      
	   
		
	});
			
	//while(resolved == 0) { console.log('waiting');  }
	//var pr = p.reflect();

	//then(function(data) {
	//           console.log('Response - ' + data );
	 //   }).catch(function(err){
	 //           console.log('Error - ' + err);
	//});     
	return new Promise((resolve, reject) => {
		var allpromises = [p];        
		bluebird.all(allpromises.map(function(pr) {  return pr.reflect();   })).each(function(inspection) {
			if (inspection.isFulfilled()) {
				console.log("A promise in the array was fulfilled with", inspection.value());
				resolve(inspection.value());
				if(regprodsquery.length > 0) {
					res.send({
							replies: [{
								type: 'text',
								content: inspection.value()
							},
							{
							  type: 'list',					  
							  content: { 
								elements: regprodsquery,
							  }
							}],
							conversation: {
							  memory: memory
							}
					});
				}
				else {
					res.send({
							replies: [{
								type: 'text',
								content: inspection.value()
							},
							{
							  type: 'list',					  
							  content: { 
								elements: regprods,
							  }
							}],
							conversation: {
							  memory: memory
							}
					});
					
				}
				
			} else {
				console.error("A promise in the array was rejected with", inspection.reason());
				reject(inspection.reason());
				res.send({
					replies: [{
					  type: 'quickReplies',
					  content: { 
						title: `You do not have any registered product yet.
The ticket will be created without products.
Press Continue to proceed.`,
						buttons: [{ title: 'Continue', value: 'Continue' }],
					  }
					}],
					conversation: {
					  memory: memory
					}
				  });
			}
		});        
	});
	

});


app.post('/weather', (req, res) => {
	
	var memory = req.body.conversation.memory;
	let city = '';
	if(memory.location && memory.location.formatted) {
		city = memory.location.formatted.toString(); }
	else {
		res.send({
					replies: [{
					  type: 'text',
					  content: `Sorry the city cannot be found.
Please be more specific`,
					}],
					conversation: {
					  memory: memory
					}
				  });
		return;
	}
	
	return new Promise((resolve, reject) => {
        // Create the path for the HTTP request to get the weather
        let path = '/premium/v1/weather.ashx?format=json&num_of_days=1' +
          '&q=' + encodeURIComponent(city) + '&key=' + wwoApiKey;
        console.log('API Request: ' + host + path);
        
        // Make the HTTP request to get the weather
        http.get({host: host, path: path}, (httpres) => {
          let body = ''; // var to store the response chunks    
          httpres.on('data', (d) => { body += d; }); // store each response chunk
          httpres.on('end', () => {
            // After all the data has been received parse the JSON for desired data
            let response = JSON.parse(body);
            let forecast = response['data']['weather'][0];
            let location = response['data']['request'][0];
            let conditions = response['data']['current_condition'][0];
            let currentConditions = conditions['weatherDesc'][0]['value'];
    
            // Create response
            let output = `Current conditions in the ${location['type']}
${location['query']} are ${currentConditions} with a projected high of
${forecast['maxtempC']}°C and a low of ${forecast['mintempC']}°C.`;

            // Resolve the promise with the output text
            console.log(output);
			res.send({
					replies: [{
					  type: 'text',
					  content: output,
					}],
					conversation: {
					  memory: memory
					}
				  });
				  
            resolve(output);
            
            });
          httpres.on('error', (error) => {
            console.log(`Error calling the weather API: ${error}`);
			res.send({
					replies: [{
					  type: 'text',
					  content: 'Error calling the weather API',
					}],
					conversation: {
					  memory: memory
					}
				  });
				  
            reject();
            });
        });     
      });

});


app.post('/errors', (req, res) => {
  console.log(req.body);
  res.send(); 
}) 

app.listen(port, () => { 
  console.log('Server is running on port 5000');
})