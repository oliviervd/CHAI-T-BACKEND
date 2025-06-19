# CHAI-T-Backend-Aggregator

Node module and CLI-application to import, parse, and synchronize thesauri from Design Museum Gent, VAI, and MoMU as part of the CHAI-T project.

## Prerequisites

1. Node.js installed on your computer ([Download from nodejs.org](https://nodejs.org/))
2. Access to Supabase credentials

## Installation

1. Clone this repository
2. Install dependencies:
3. Create a `.env` file with your Supabase credentials

## usage 
Run the command with two required parameters:

- `-f, --file`: Path to the JSON-LD file to upload
- `-o, --org`: Organization code (must be one of: MOMU, DMG, VAI)

example
``` bash
node clients.js -f data/example.jsonld -o VAI
```
