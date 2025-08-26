import React from 'react';
import { marked } from 'marked';

const FormattedArenaResponse = ({ text, responseTime, messageId }) => {
  // Function to process markdown and citations in Arena bot text
  const processCitations = (text) => {
    if (!text) return { processedText: '', citations: [] };

    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    const citations = [];
    const citationMap = new Map();
    let citationCounter = 1;
    
    let tempText = text.replace(/\[([^\]]+)\]/g, (match, rawCitationText) => {
      let citationNumber;
      let citationId;

      if (citationMap.has(rawCitationText)) {
        citationNumber = citationMap.get(rawCitationText);
        citationId = `arena${messageId}-ref${citationNumber}`;
      } else {
        citationNumber = citationCounter++;
        citationId = `arena${messageId}-ref${citationNumber}`;
        citationMap.set(rawCitationText, citationNumber);
        
        // First, process the markdown within the citation
        let citationHtml = marked.parseInline(rawCitationText.trim());

        // --- START OF THE FIX: Make DOI links green ---
        // After creating the link, find the <a> tag and add a style to it.
        citationHtml = citationHtml.replace(
          /<a href/g, 
          '<a style="color: #4ade80; text-decoration: underline;" href'
        );
        // --- END OF THE FIX ---

        citations.push({
          id: citationId,
          text: citationHtml,
          number: citationNumber,
        });
      }

      // Return the superscript that will replace the [...] block
      return `<sup><a href="#${citationId}" class="citation-link" style="color: #4ade80; text-decoration: none; font-weight: 500;">${citationNumber}</a></sup>`;
    });

    let processedText = marked(tempText);

    citations.sort((a, b) => a.number - b.number);

    return { processedText, citations };
  };

  const { processedText, citations } = processCitations(text);

  return (
    <div>
      {/* Bot response text with markdown and citations */}
      <div 
        className="text-gray-300 whitespace-pre-wrap mb-3"
        dangerouslySetInnerHTML={{ __html: processedText }}
      />
      
      {/* Citations list */}
      {citations.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-600">
          <p className="text-xs font-medium mb-2 text-gray-400">Referências:</p>
          <ol className="text-xs space-y-1 text-gray-500">
            {citations.map((citation) => (
              <li key={citation.id} id={citation.id} className="citation-item">
                <span className="font-medium text-green-400">{citation.number}.</span>{' '}
                <span dangerouslySetInnerHTML={{ __html: citation.text }} />
              </li>
            ))}
          </ol>
        </div>
      )}
      
      {/* Response time */}
      {responseTime && (
        <div className="mt-2 text-xs text-gray-500">
          Resposta em <span className="text-green-400 font-medium">{responseTime.toFixed(1)}s</span>
        </div>
      )}
    </div>
  );
};

export default FormattedArenaResponse;