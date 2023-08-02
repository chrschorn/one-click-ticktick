var documentClone = document.cloneNode(true);
var readable = new Readability(documentClone).parse();
var markdown = new TurndownService({
    codeBlockStyle: 'fenced',
    headingStyle: 'atx',
    hr: '---'
}).turndown(readable.content);
markdown  // return value