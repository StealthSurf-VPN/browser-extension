# Code Style Guidelines

## Communication Language

**IMPORTANT**: Always respond to the user in Russian language.

All code, comments, and JSDoc must be in English. UI strings are in Russian.

## JavaScript/JSX

### Conditional Statements

Omit curly braces for single-line `if` statements:

```javascript
// Correct
if (condition) doSomething()

// Incorrect
if (condition) {
  doSomething()
}
```

### Variable Declarations

Add vertical spacing between variable declarations:

```javascript
// Correct
const data = JSON.parse(response)

const userId = data.id

const userName = data.name
```

### Functions

Use arrow functions. Omit braces for single expressions:

```javascript
// Correct
const getData = () => fetch("/api/data")

const processData = data => data.map(item => item.value)
```

### Comments

Do not write comments unless explicitly asked. Comments must be in English.

### Imports

Use relative imports (extensions don't support absolute `/src/...` paths):

```javascript
// Correct
import { MSG } from "../../shared/constants"
import { NETWORK } from "../api.instance"

// Incorrect
import { MSG } from "/src/shared/constants"
```

## Formatting

- Run `npm run format` (Biome) before committing
- Tabs for indentation
- Double quotes for strings
- Classic JSX runtime (`import React from "react"`)
