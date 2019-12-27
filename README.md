# Gatsby Source Google Calendar Events
The initial iteration of this plugin is simply to read all single events for a given calendar associated with a GSuite account over a specified duration and expose this information within the Gatsby ecosystem as static data consumed via graphql.

## Google Calendar Integration
	- Assumptions:
		- Google Suite account exists
		- Single Calendar exists with specific user that contains all public events for website display

### Pre-requisites
1. Creating a Service Account
	- Ensure role given to account is Project --> Owner
	- Enable Domain Wide Access to service account
	- After doing this, download .json key file

2. Enabling Service Account as Authorized Client in Domain
[GSuite Admin Console](https://admin.google.com/AdminHome?chromeless=1#OGX:ManageOauthClients)

For client name, use the client ID associated with the service account and allow the following scopes:  `https://www.googleapis.com/auth/calendar.events.readonly, https://www.googleapis.com/auth/calendar.readonly`

### Configuration Options and Defaults

Configuration options are as follows:

	- **CalendarId**: `string` . This is the google calendar to be used as a data source.
	- **IncludedFields**: `arrayOf(strings)`. The fields to be included in the graphql schema from the Google Calendar API
	- **timeMax**: `date-time`. Upper bound for events to return, by start time of event.
	- **timeMin**: `date-time`. Lower bound for events to return, by end time of event.
	- **pemFilePath**: `string`. Path to `.json` key  used for authentication of Google API requests in local development
	- **envVar**: `string`. Stringified `.json` pem file  used for authentication of Google API requests in Production
	- **scopes**: `arrayOf(strings)`. Permissions for Google Clients interaction with API

### Default Configuration Values
```javascript
{
    includedFields: ['start', 'end', 'summary', 'status', 'organizer', 'description', 'location'],
    calendarId: '',
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

```

### Configuration Example
```javascript
{
      resolve: `gatsby-source-google-calendar-events`,
      options: {
        envVar: GOOGLE_CALENDAR_SERVICE_ACCOUNT_KEY,
        calendarId: 'user@gsuite-domain.com'
      }
    },

```

### Required Configuration Options
	- **pemFilePath** OR **envVar**
	- **calendarId**

Pull requests welcome!