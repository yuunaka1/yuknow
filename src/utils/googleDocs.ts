export async function fetchGoogleDocText(docId: string, accessToken: string): Promise<string> {
  const url = `https://docs.googleapis.com/v1/documents/${docId}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('Permission denied. Please ensure your Google Cloud Project has the Google Docs API enabled and you have authorized access.');
    }
    const err = await response.json();
    throw new Error(`Failed to fetch document: ${err.error?.message || response.statusText}`);
  }

  const doc = await response.json();
  
  let text = '';
  if (doc.body && doc.body.content) {
    doc.body.content.forEach((element: any) => {
      text += readStructuralElement(element);
    });
  }
  
  return text.trim();
}

function readStructuralElement(element: any): string {
  let text = '';
  if (element.paragraph && element.paragraph.elements) {
    element.paragraph.elements.forEach((elem: any) => {
      if (elem.textRun && elem.textRun.content) {
        text += elem.textRun.content;
      }
    });
  } else if (element.table && element.table.tableRows) {
    element.table.tableRows.forEach((row: any) => {
      if (row.tableCells) {
        row.tableCells.forEach((cell: any) => {
          if (cell.content) {
            cell.content.forEach((cellContent: any) => {
              text += readStructuralElement(cellContent);
            });
          }
        });
      }
    });
  } else if (element.tableOfContents && element.tableOfContents.content) {
     element.tableOfContents.content.forEach((elem: any) => {
        text += readStructuralElement(elem);
     });
  }
  return text;
}
