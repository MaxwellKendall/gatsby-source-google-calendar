const { google } = require('googleapis');
const moment = require('moment');
const fs = require('fs');

const requiredFields = ['id', 'internal'];
const defaultOptions = {
    includedFields: ['start', 'end', 'summary', 'status', 'organizer', 'description', 'location'],
    calendarId: '',
    assumedUser: '',
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

const processEvents = (event, fieldsToInclude) => {
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
        scopes } = { ...defaultOptions, ...options };
    
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
  
    // Process data into nodes.
    items
        .map(item => ({
            ...item,
            internal: {
                contentDigest: item.updated,
                type: 'GoogleCalendarEvent'
            }
        }))
        .forEach(event => createNode(processEvents(event, includedFields)))
  
    // We're done, return.
    return
};
