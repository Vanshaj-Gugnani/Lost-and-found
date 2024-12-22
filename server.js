const express = require("express");
const { db } = require("./firebase");
const nodemailer = require("nodemailer");
const app = express();
app.use(express.json());
const stringSimilarity = require("string-similarity");
const admin = require("firebase-admin");
const { verify } = require("crypto");
const path = require('path');

app.use(express.static(path.join(__dirname, 'public')));

// Set view engine to EJS
app.set('view engine', 'ejs');

// const verifyToken = async (req, res, next) => {
//   try {
//     const idToken = req.headers.authorization?.split("Bearer ")[1];
//     if (!idToken) return res.status(401).json({ error: "Unauthorized" });

//     const decodedToken = await admin.auth().verifyIdToken(idToken);
//     req.user = decodedToken;
//     next();
//   } catch (error) {
//     console.error("Auth error:", error);
//     res.status(401).json({ error: "Invalid or expired token" });
//   }
// };


const twilio = require("twilio");
const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const sendSMS = async (phoneNumber, message) => {
    try {
      await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,  
        to: phoneNumber,
      });
      console.log("Message sent successfully");
    } catch (error) {
      console.error("Error sending SMS:", error.message);
    }
  };


// Protect routes
//email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_SENDER,
    pass: process.env.EMAIL_SENDER_PASSWORD,
  },
});

// will add a item returnns an id of the item 
const Joi = require("joi");
const axios = require("axios"); // Ensure axios is installed

const itemSchema = Joi.object({
  title: Joi.string().required(),
  description: Joi.string().required(),
  location: Joi.object({
    address: Joi.string().required(), // Store the address as a string
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).required(),
  contact_info: Joi.object({
    email: Joi.string().email().required(),
    phone: Joi.string().required(),
  }).required(),
  status: Joi.string().valid("open", "closed").required(),
  type: Joi.string().required(),
  brand: Joi.string().required(),
  color: Joi.string().required(),
});

const crypto = require("crypto"); // Import crypto module

app.post("/items", async (req, res) => {
  try {
    // Extract location string and other data from the request body
    const { location: address, contact_info, ...itemData } = req.body;

    if (!address || typeof address !== "string") {
      return res.status(400).json({ error: "Invalid or missing address string" });
    }

    if (!contact_info || !contact_info.email) {
      return res.status(400).json({ error: "Missing or invalid contact email" });
    }

    // Geocode the location string using OpenStreetMap Nominatim API
    const geocodeLocation = async (address) => {
      try {
        const response = await axios.get("https://nominatim.openstreetmap.org/search", {
          params: {
            q: address,
            format: "json",
            addressdetails: 1,
          },
        });

        if (response.data.length > 0) {
          const location = response.data[0];
          return { latitude: parseFloat(location.lat), longitude: parseFloat(location.lon) };
        } else {
          throw new Error("Address not found");
        }
      } catch (error) {
        console.error("Geocoding error:", error.message);
        throw new Error("Failed to geocode location");
      }
    };

    // Geocode the address string
    const geoLocation = await geocodeLocation(address);

    // Generate a random ID for the document
    const randomId = crypto.randomBytes(4).toString("hex");

    // Merge geocoded location, original address, and other item data
    const completeItemData = {
      ...itemData,
      location: {
        address, // Include the original address string
        ...geoLocation, // Include latitude and longitude
      },
      contact_info, // Include user contact info
    };

    // Validate the merged data against the updated Joi schema
    const { error, value } = itemSchema.validate(completeItemData);
    if (error) return res.status(400).json({ error: error.details[0].message });

    // Add the validated item to Firestore with the random ID as document name
    await db.collection("Items").doc(randomId).set(value);

    // Craft an html message with the reference number
    const emailMessage = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lost-and-Found Case Created</title>
    <style>
      /* General Styles */
      body {
        font-family: 'Arial', sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f4f7fb;
        color: #333;
      }
      h1, h2 {
        margin: 0;
      }
      p {
        margin: 0 0 16px;
        font-size: 16px;
        line-height: 1.6;
      }

      /* Header Styles */
      .header {
        background-color: #1d3557;
        color: #ffffff;
        text-align: center;
        padding: 20px;
        border-bottom: 4px solid #e63946;
      }
      .header h1 {
        font-size: 28px;
      }
      .header svg {
        width: 80px;
        height: 80px;
        margin-bottom: 10px;
      }

      /* Card Container for Email Content */
      .content-container {
        background-color: #ffffff;
        max-width: 600px;
        margin: 20px auto;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
      }
      .content-container h2 {
        font-size: 24px;
        color: #2b2d42;
        margin-bottom: 10px;
      }
      .content-container p span {
        font-weight: bold;
        color: #e63946;
      }

      /* Button Styling */
      .button {
        display: inline-block;
        background-color: #e63946;
        color: #ffffff;
        text-decoration: none;
        padding: 12px 20px;
        font-size: 16px;
        border-radius: 5px;
        margin-top: 20px;
        text-align: center;
      }
      .button:hover {
        background-color: #d52b2b;
      }

      /* Footer Styles */
      .footer {
        background-color: #1d3557;
        color: #ffffff;
        text-align: center;
        padding: 20px;
        font-size: 14px;
        margin-top: 30px;
      }
      .footer a {
        color: #e63946;
        text-decoration: none;
        font-weight: bold;
      }

      /* Responsive Design */
      @media screen and (max-width: 600px) {
        .content-container {
          padding: 20px;
        }
        .header h1 {
          font-size: 24px;
        }
      }
    </style>
  </head>
  <body>
    <!-- Header with Logo -->
    <div class="header">
      <!-- Inline SVG Logo -->
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
        <g id="_14-lost_and_found" data-name="14-lost and found">
          <path d="M32,1a4,4,0,0,1,4,4H33a1,1,0,0,0-2,0H28A4,4,0,0,1,32,1Z" style="fill:#707789" />
          <path d="M43.85,11.1,42,25H39l1-11.54V13C41.85,13,43.4,12.69,43.85,11.1Z" style="fill:#f26973" />
          <path d="M36,11V25H33L32,13.46V13c2.21,0,4-.45,4-3Z" style="fill:#f26973" />
          <path d="M36,10c0,2.55,1.79,3,4,3v.46L39,25H36V10Z" style="fill:#e65263" />
        </g>
      </svg>
      <h1>Case Created Successfully</h1>
    </div>

    <!-- Main Content Section -->
    <div class="content-container">
      <h2>Great News!</h2>
      <p>Your lost-and-found case has been successfully created.</p>
      <p><strong>Your case number is:</strong> <span>${randomId}</span></p>
      <p>Use this reference number to track your case and get updates about the status of your item. You will be notified once your item is found and ready for retrieval.</p>
      <p>We are committed to helping you recover your lost belongings!</p>
      <!-- Track Case Button -->
      <a href="#" class="button">Track My Case</a>
    </div>

    <!-- Footer with Contact Info -->
    <div class="footer">
      <p>Best regards,</p>
      <p><strong>The Lost-and-Found Team</strong></p>
      <p>Have any questions? <a href="mailto:vanshajgugnani04@gmail.com">Contact Support</a></p>
      <p>&copy; 2024 Lost-and-Found. All rights reserved.</p>
    </div>
  </body>
</html>



    `;    
    

    // Send email to the user
    await transporter.sendMail({
      from: process.env.EMAIL_SENDER,
      to: contact_info.email,
      subject: "Lost-and-Found Case Created",
      html: emailMessage,
    });

    res.status(200).json({
      message: "Item added successfully",
      id: randomId, // Return the random ID to the user
      
    });
  } catch (error) {
    console.error("Error in /items route:", error.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

  
//close the case status
app.put("/items/:caseNumber/status", async (req, res) => {
    try {
      const { caseNumber } = req.params;
  
      // Check if the caseNumber is provided
      if (!caseNumber) {
        return res.status(400).json({ error: "Case number is required" });
      }
  
      // Retrieve the document from Firestore
      const docRef = db.collection("Items").doc(caseNumber);
      const docSnapshot = await docRef.get();
  
      if (!docSnapshot.exists) {
        return res.status(404).json({ error: "Case not found" });
      }
  
      // Update the status to "closed"
      await docRef.update({ status: "closed" });
  
      res.status(200).json({ message: `Case ${caseNumber} has been updated to 'closed'` });
    } catch (error) {
      console.error("Error updating case status:", error.message);
      res.status(500).json({ error: "Internal server error" });
    }
  });
  


// will get all items
app.get("/items", async (req, res) => {
  try {
    const snapshot = await db.collection("Items").get();
    const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


//confirmation route
app.get('/confirm/:caseId', (req, res) => {
  // console.log(req.params.caseId);
    res.render('confirm', {
        caseId: req.params.caseId,
    });
});

// update route
app.put("/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const newData = req.body;  
  
      await db.collection("Items").doc(id).update(newData);
      res.status(200).json({ message: "Item updated successfully" });
    } catch (error) {
      console.error("Error updating item:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
// delete route
app.delete("/items/:id", async (req, res) => {
    try {
      const { id } = req.params;
  
      await db.collection("Items").doc(id).delete();
      res.status(200).json({ message: "Item deleted successfully" });
    } catch (error) {
      console.error("Error deleting item:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
// filter query route
app.get("/items/filter", async (req, res) => {
    try {
      const { status, type } = req.query;
  
      let query = db.collection("Items");
      if (status) query = query.where("status", "==", status);
      if (type) query = query.where("type", "==", type);
  
      const snapshot = await query.get();
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  
      res.status(200).json(items);
    } catch (error) {
      console.error("Error filtering items:", error);
      res.status(500).json({ error: error.message });
    }
  });
  



// Route to check matches
app.get("/items/match", async (req, res) => {
    try {
      // Retrieve only open lost and found items
      const lostSnapshot = await db
        .collection("Items")
        .where("title", "==", "lost")
        .where("status", "==", "open")
        .get();
  
      const foundSnapshot = await db
        .collection("Items")
        .where("title", "==", "found")
        .where("status", "==", "open")
        .get();
  
      console.log("Lost snapshot size:", lostSnapshot.size);
      console.log("Found snapshot size:", foundSnapshot.size);
  
      const lostItems = [];
      const foundItems = [];
  
      lostSnapshot.forEach((doc) => lostItems.push({ id: doc.id, ...doc.data() }));
      foundSnapshot.forEach((doc) => foundItems.push({ id: doc.id, ...doc.data() }));
  
      console.log("lost = ", lostItems, "found = ", foundItems);
  
      const matches = [];
  
      // Haversine formula for calculating distance in kilometers
      const haversineDistance = (lat1, lon1, lat2, lon2) => {
        const toRadians = (degrees) => (degrees * Math.PI) / 180;
        const R = 6371;
        const dLat = toRadians(lat2 - lat1);
        const dLon = toRadians(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) ** 2 +
          Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };
  
      // Compare lost items with found items
      lostItems.forEach((lost) => {
        foundItems.forEach((found) => {
          // Calculate similarity scores for type, description, brand, and color
          const typeSimilarity = stringSimilarity.compareTwoStrings(
            lost.type.toLowerCase(),
            found.type.toLowerCase()
          );
  
          const descriptionSimilarity = stringSimilarity.compareTwoStrings(
            lost.description.toLowerCase(),
            found.description.toLowerCase()
          );
  
          const brandSimilarity = stringSimilarity.compareTwoStrings(
            lost.brand.toLowerCase(),
            found.brand.toLowerCase()
          );
  
          const colorSimilarity = stringSimilarity.compareTwoStrings(
            lost.color.toLowerCase(),
            found.color.toLowerCase()
          );
  
          // Calculate distance between lost and found locations
          const distance = haversineDistance(
            lost.location.latitude,
            lost.location.longitude,
            found.location.latitude,
            found.location.longitude
          );
  
          // Check thresholds for similarity and distance
          if (
            typeSimilarity > 0.6 &&
            descriptionSimilarity > 0.5 &&
            brandSimilarity > 0.9 &&
            colorSimilarity > 0.8 &&
            distance <= 20 // Ensure the distance is within 20 km
          ) {
            matches.push({
              lostItem: lost,
              foundItem: found,
              typeSimilarity: typeSimilarity.toFixed(2),
              descriptionSimilarity: descriptionSimilarity.toFixed(2),
              brandSimilarity: brandSimilarity.toFixed(2),
              colorSimilarity: colorSimilarity.toFixed(2),
              distance: distance.toFixed(2), // Include the distance in the match data
            });
          }
        });
      });
  
      if (matches.length > 0) {
        for (const match of matches) {
          const { lostItem, foundItem } = match;
  
          const lostPhone = lostItem.contact_info.phone;
          const lostEmail = lostItem.contact_info.email;
          const foundLocation = foundItem.location;
  
          if (lostPhone) {
            const message = `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Item Found Notification</title>
                <style>
                  /* General Styles */
                  body {
                    font-family: 'Arial', sans-serif;
                    margin: 0;
                    padding: 0;
                    background-color: #f4f7fb;
                    color: #333;
                  }
                  h1, h2 {
                    margin: 0;
                  }
                  p {
                    margin: 0 0 16px;
                    font-size: 16px;
                    line-height: 1.6;
                  }
            
                  /* Header Styles */
                  .header {
                    background-color: #1d3557;
                    color: #ffffff;
                    text-align: center;
                    padding: 20px;
                    border-bottom: 4px solid #e63946;
                  }
                  .header h1 {
                    font-size: 28px;
                  }
                  .header svg {
                    width: 80px;
                    height: 80px;
                    margin-bottom: 10px;
                  }
            
                  /* Card Container for Email Content */
                  .content-container {
                    background-color: #ffffff;
                    max-width: 600px;
                    margin: 20px auto;
                    padding: 30px;
                    border-radius: 8px;
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                  }
                  .content-container h2 {
                    font-size: 24px;
                    color: #2b2d42;
                    margin-bottom: 10px;
                  }
                  .content-container p span {
                    font-weight: bold;
                    color: #e63946;
                  }
            
                  /* Button Styling */
                  .button {
                    display: inline-block;
                    background-color: #e63946;
                    color: #ffffff;
                    text-decoration: none;
                    padding: 12px 20px;
                    font-size: 16px;
                    border-radius: 5px;
                    margin-top: 20px;
                    text-align: center;
                  }
                  .button:hover {
                    background-color: #d52b2b;
                  }
            
                  /* Footer Styles */
                  .footer {
                    background-color: #1d3557;
                    color: #ffffff;
                    text-align: center;
                    padding: 20px;
                    font-size: 14px;
                    margin-top: 30px;
                  }
                  .footer a {
                    color: #e63946;
                    text-decoration: none;
                    font-weight: bold;
                  }
            
                  /* Responsive Design */
                  @media screen and (max-width: 600px) {
                    .content-container {
                      padding: 20px;
                    }
                    .header h1 {
                      font-size: 24px;
                    }
                  }
                </style>
              </head>
              <body>
                <!-- Header with Logo -->
                <div class="header">
                  <!-- Inline SVG Logo -->
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                    <g id="_14-lost_and_found" data-name="14-lost and found">
                      <path d="M32,1a4,4,0,0,1,4,4H33a1,1,0,0,0-2,0H28A4,4,0,0,1,32,1Z" style="fill:#707789" />
                      <path d="M43.85,11.1,42,25H39l1-11.54V13C41.85,13,43.4,12.69,43.85,11.1Z" style="fill:#f26973" />
                      <path d="M36,11V25H33L32,13.46V13c2.21,0,4-.45,4-3Z" style="fill:#f26973" />
                      <path d="M36,10c0,2.55,1.79,3,4,3v.46L39,25H36V10Z" style="fill:#e65263" />
                    </g>
                  </svg>
                  <h1>Item Found Notification</h1>
                </div>
            
                <!-- Main Content Section -->
                <div class="content-container">
                  <h2>Good News!</h2>
                  <p>We are delighted to inform you that your lost item, <span>${lostItem.type}</span>, has been found.</p>
                  <p><strong>Location Details:</strong></p>
                  <ul>
                    <li><strong>Address:</strong> ${foundLocation.address}</li>
                    <li><strong>Coordinates:</strong> Latitude: ${foundLocation.latitude}, Longitude: ${foundLocation.longitude}</li>
                    <li><strong>Distance:</strong> ${match.distance} km</li>
                  </ul>
                  <p>We hope this helps you retrieve your item quickly and easily!</p>
                  <!-- Track Case Button -->
                  <a href="#" class="button">Track My Case</a>
                </div>
            
                <!-- Footer with Contact Info -->
                <div class="footer">
                  <p>Best regards,</p>
                  <p><strong>The Lost-and-Found Team</strong></p>
                  <p>Have any questions? <a href="mailto:vanshajgugnani04@gmail.com">Contact Support</a></p>
                  <p>&copy; 2024 Lost-and-Found. All rights reserved.</p>
                </div>
              </body>
            </html>
            `;
                        console.log("message = ", message);
  
            // Uncomment these lines to send SMS and email
            // await sendSMS(lostPhone, message);
            await transporter.sendMail({
              from: process.env.EMAIL_SENDER,
              to: lostEmail,
              subject: "Lost Item Found",
              html: message,
            });
          }
        }
      }
  
      res.status(200).json({
        message: "Matching items retrieved successfully",
        matches: matches,
      });
    } catch (error) {
      console.error("Error checking matches:", error);
      res.status(500).json({ error: error.message });
    }
  });
  
  

app.get('/', (req, res) => {
    res.render('index');
});

app.get('/report-lost', (req, res) => {
    res.render('lost', { route: '/report-lost' });
});


app.get('/report-found', (req, res) => {
    res.render('lost', { route: '/report-found' });
});
  

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { 
  console.log(`Server running on http://localhost:${PORT}`);
});

