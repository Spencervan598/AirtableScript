//Settings
const config = input.config({
    title: 'Helium Api Requests',
    description: 'Query `https://api.helium.io` for specified data.',
    items: [
        input.config.table('hTable', {
            label: 'Hotspot Name/Address Table',
            description: "Please Select Table containing hotspot addresses/names"
        }),
        input.config.field('nField', {
            parentTable: 'hTable',
            label: 'Field Containing Hotspot Names',
            description: 'Please select field containing hotspot names. Select address field if name field does not exist.'
        }),
        input.config.field('aField', {
            parentTable: 'hTable',
            label: 'Field Containing Hotspot Addresses',
            description: 'Please select field containing hotspot addresses. Select name field if address field does not exist.'
        }),
        input.config.field('assField', {
            parentTable: 'hTable',
            label: 'Field For Location Assertions',
            description: 'Please select field to output: location assertion dates.'
        }),
        input.config.field('rewField', {
            parentTable: 'hTable',
            label: 'Field For First Reward',
            description: 'Please select field to output: first reward.'
        }),
        input.config.field('pocField', {
            parentTable: 'hTable',
            label: 'Field For First PoC Reward',
            description: 'Please select field to output: first PoC reward.'
        }),
        input.config.field('atbField', {
            parentTable: 'hTable',
            label: 'Field For Added To Blockchain',
            description: 'Please select field to output: date added to blockchain'
        }),
        input.config.field('dtrField', {
            parentTable: 'hTable',
            label: 'Field For First Data Transfer Reward Transaction',
            description: 'Please select field to output: data transfer reward trx'
        }),
        input.config.select('filter', {
            label: 'What to pull first',
            description:'',
            options: [
                {label:'Added to Blockchain', value:'1'},
                {label:'Rewards', value:'2'},
                {label:'', value:'3'},
                {label:'', value:'4'},
                {label:'', value:'5'},
            ]

        })
    ]
})
//Setting Vars
let baseUrl = `https://api.helium.io/v1/`
let addTable = config.hTable
let addField = config.aField
let namField = config.nField
let pocOutField = config.pocField
let assOutField = config.assField
let rewOutField = config.rewField
let rewOutFieldID = rewOutField.id
let atbOutField = config.atbField
let atbOutFieldID = atbOutField.id
let dtrOutField = config.dtrField
let dtrOutFieldId = dtrOutField.id
const limit = '100'
let i = 0
let i1 = 0
// Query addField for Records
let addQuery = await addTable.selectRecordsAsync({
    fields: [addField, namField, atbOutField]
})


//Template for object containing arrays of data used throughout script
let hotspot = {
    hsName: new Array(),
    hsAddress: new Array(),
    recordID: new Array(),
    atbISO: new Array(),
    atbISOnext: new Array(),
    precursorTime: new Array(),
    rewISO: new Array(),
    methods: {

    },
    peristance: new Array()

}
// Will use in future for optimising/abstraction/whatever its called
// function timeWrapper(dataArraywIndex){
//     dataArraywIndex[dataArraywIndex.length -1]
// }

async function atbFunc() {
    for (let record of addQuery.records) {
        if (!record.getCellValue(addField) || record.getCellValue(atbOutField)) {
            continue;
        }
        let atbFetch = await fetch(`${baseUrl}hotspots/${record.getCellValueAsString(addField)}`)
        let atbData = await atbFetch.json()
        hotspot.atbISO.push(new Date(atbData.data.timestamp_added))
        hotspot.hsName.push(record.getCellValueAsString(namField))
        hotspot.hsAddress.push(record.getCellValueAsString(addField))
        hotspot.recordID.push(record.id)
        let intermediary = new Date(hotspot.atbISO.pop())
        hotspot.atbISO.push(intermediary.toISOString())
        intermediary.setDate(intermediary.getDate() + 2)
        hotspot.atbISOnext.push(intermediary.toISOString())
        await addTable.updateRecordAsync(record, {
            [atbOutFieldID]: hotspot.atbISO[hotspot.atbISO.length - 1]
        })


        function nextDate() {
            let intermediary = new Date(hotspot.atbISOnext.pop())
            intermediary.setDate(intermediary.getDate() + 1)
            hotspot.atbISOnext.push(intermediary.toISOString())
        }

        async function rewWrapAndWrite(cursor = null) {
            i++
            if (i >= 25) {
                hotspot.rewISO.push(new Date().toISOString())
                return console.log(`hit limit rewrap`)
            }


            let response = await apiFetch(record.getCellValueAsString(addField), cursor)
            let data = [response[0].data, response[1].data]
            if (data[0].length > 0 || data[1].length > 0) {
                //Only data[1] contains data
                if (data[0].length == 0 && data[1].length < parseInt(limit)) {
                    hotspot.rewISO.push(new Date(data[1][data[1].length - 1]['time'] * 1000).toISOString())
                    await addTable.updateRecordAsync(record, { [rewOutFieldID]: hotspot.rewISO[hotspot.rewISO.length - 1] })
                }

                else { if (data[1].length >= parseInt(limit)) { console.log('data[1] is at $limit') } }

                //Only data[0] contains data
                if (data[1].length == 0 && data[0].length < parseInt(limit)) {
                    hotspot.rewISO.push(new Date(data[0][data[0].length - 1]['time'] * 1000).toISOString())
                    await addTable.updateRecordAsync(record, { [rewOutFieldID]: hotspot.rewISO[hotspot.rewISO.length - 1] })
                }
                //data[0] & data[1] contain data
                if (data[0].length > 0 && data[1].length > 0 && data[1].length < parseInt(limit)) {
                    hotspot.rewISO.push(new Date(data[1][data[1].length - 1]['time'] * 1000).toISOString())
                    await addTable.updateRecordAsync(record, { [rewOutFieldID]: hotspot.rewISO[hotspot.rewISO.length - 1] })
                }

                else { if (data[1].length >= parseInt(limit)) { console.log('data[1] at $limit') } }

            }
            else { console.log('else'); nextDate(); await rewWrapAndWrite() }
        }


        await rewWrapAndWrite()


    }
}

async function apiFetch(address, cursor = null, filter = 'rewards_v2') {
    if (i1 > 5) { i1 = 0; hotspot.rewISO.push(new Date().toISOString()); console.log('apifetch limit reached'); return 256 }
    let currentIndex = hotspot.hsAddress.indexOf(address)
    if (!address || (new Date(hotspot.atbISOnext[currentIndex]) > new Date())) { return 0 }

    if (!cursor) {
        let temResponse = await fetch(`https://api.helium.io/v1/hotspots/${address}/activity?min_time=${hotspot.atbISO[currentIndex]}&max_time=${hotspot.atbISOnext[currentIndex]}&limit=${limit}&filter_types=rewards_v2`)
        let temData = await temResponse.json()
        return [temData, await apiFetch(address, temData.cursor)]

    }

    else {
        let temResponse = await fetch(`https://api.helium.io/v1/hotspots/${address}/activity?cursor=${cursor}`)
        let temData = await temResponse.json()
        return temData
    }
}

