const { google } = require('googleapis');
const maps = require("@googlemaps/google-maps-services-js").Client;
const moment = require('moment');
const fs = require('fs');

const requiredFields = ['id', 'internal'];
const googleMapsClient = new maps({});
const defaultOptions = {
    includedFields: ['start', 'end', 'summary', 'status', 'organizer', 'description', 'location', 'slug'],
    calendarId: '',
    assumedUser: '',
    geoCodeApiKey: process.env.GOOGLE_MAPS_API_KEY,
    envVar: '',
    pemFilePath: '',
    // only events after today
    timeMin: moment().format(),
    // only events two years from now
    timeMax: moment().add(2, 'y').format(),
    scopes: [
        `https://www.googleapis.com/auth/calendar.events.readonly`,
        `https://www.googleapis.com/auth/calendar.readonly`
    ]
};
const forbiddenChars = [',', '!', '#', '?', '.'];

const getLongAndLat = (key, event) => {
    return googleMapsClient
        .geocode({
            params: {
                address: event.location,
                key
            }
        })
        .then((data) => {
            const coordinates = data.data.results.find((result) => result.geometry.location);
            if (coordinates) {
                return coordinates.geometry.location;
            }
            else {
                return null;
            }
        })
        .catch((e) => {
            console.error(`error fetching long and lat for ${event.location}: ${e}`);
            return null;
        });
};

const getSlug = (event) => {
    const summary = event.summary
        .split(" ")
        .map((word) => {
            return word
                .toLowerCase()
                .split('')
                .filter((char) => !forbiddenChars.includes(char))
                .join('')
        })
        .join("-");
    
    const date = event.start.date
        ? event.start.date
        : moment(event.start.dateTime).format('MM-DD-YYYY');
    
    return `${date}/${summary}`;
};

const processEventObj = (event, fieldsToInclude) => {
    return Object.keys(event)
        .reduce((acc, key) => {
            if (fieldsToInclude.concat(requiredFields).includes(key)) {
                return {
                    ...acc,
                    [key]: event[key]
                };
            }
            return acc;
        }, {});
};

const getAuth = (options) => {
    if (options.envVar) return JSON.parse(options.envVar);
    if (fs.existsSync(options.pemFilePath)) {
        return require(options.pemFilePath);
    }
}

exports.sourceNodes = async ({ actions }, options = defaultOptions) => {
    const key = getAuth(options);
    const { createNode } = actions
    const {
        assumedUser,
        calendarId,
        includedFields,
        timeMax,
        timeMin,
        geoCodeApiKey,
        scopes
    } = { ...defaultOptions, ...options };
    
    // setting the general auth property for client
    const token = new google.auth.JWT(
        key.client_email,
        null,
        key.private_key,
        scopes,
        assumedUser
    );
    google.options({ auth: token });

    // getting the calendar client
    const calendar = google.calendar('v3');

    // getting the list of items for calendar
    const { data: { items }} = await calendar.events.list({
        calendarId: calendarId,
        showDeleted: false,
        // ascending
        orderBy: 'starttime',
        // recurring events are duplicated
        singleEvents: true,
        timeMin: timeMin,
        timeMax: timeMax
     });

    const parseEventCoordinateString = (str) => str
        .split(" ")
        .map((word) => {
            return word
                .toLowerCase()
                .split('')
                .filter((char) => !forbiddenChars.includes(char))
                .join('')
        })
        .join("-");

    const getEventCoordinates = (events) => new Promise((resolve, reject) => {
        const locationData = {};
        events
            .reduce((prevPromise, event, i, arr) => {
                if (!event.location) return Promise.resolve();
                const eventLocationString = parseEventCoordinateString(event.location);
                return prevPromise
                    .then((data) => {
                        if (data === 'init') {
                            return getLongAndLat(geoCodeApiKey, event)
                                .then((data) => {
                                    locationData[eventLocationString] = data;
                                });
                        }
                        if (Object.keys(locationData).includes(eventLocationString)) {
                            if (i === arr.length - 1) {
                                return resolve(locationData);
                            }
                            return Promise.resolve();
                        }
                        else {
                            return getLongAndLat(geoCodeApiKey, event)
                                .then((data) => {
                                    locationData[eventLocationString] = data;
                                    if (i === arr.length - 1) resolve(locationData);
                                });
                        }
                    })
                    .catch((e) => {
                        console.error(`gatsby-source-google-calendar-events error during network request: ${e}`);
                        reject(e);
                    });
            }, Promise.resolve('init'));
    });
  
    // Process data into nodes.
    getEventCoordinates(items)
        .then((locationData) => {
            items
                .map((event) => {
                    const eventSlug = getSlug(event);
                    const eventCoordinateKey = event.location
                        ? parseEventCoordinateString(event.location)
                        : '';
                    const longAndLat = Object.keys(locationData).includes(eventCoordinateKey)
                        ? locationData[eventCoordinateKey]
                        : null
                    return {
                        ...event,
                        slug: eventSlug,
                        geoCoordinates: longAndLat,
                        internal: {
                            contentDigest: event.updated,
                            type: 'GoogleCalendarEvent'
                        }
                    };
                })
                .forEach(event => {
                    const eventObj = processEventObj(event, includedFields);
                    createNode(eventObj);
                })
        })
  
    // We're done, return.
    return
};

exports.createSchemaCustomization = ({ actions }) => {
    const { createTypes } = actions;

    createTypes(`
        type EventAttachment implements Node {
            fileUrl: String
            title: String
        }
        type EventTime implements Node {
            date: Date,
            dateTime: Date,
            timeZone: String
        }
         type EventCoordinates implements Node {
            lat: Float
            long: Float
        }
        type GoogleCalendarEvent implements Node {
            id: ID
            name: String
            slug: String
            status: String
            start: EventTime
            end: EventTime
            summary: String
            status: String
            organizer: String
            description: String
            location: String
            attachments: [EventAttachment]
            geoCoordinates: EventCoordinates
            admin: Boolean
            created: Date
            photo: File
        }
  `)
};
