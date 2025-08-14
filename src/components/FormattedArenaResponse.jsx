import React from 'react';
import { marked } from 'marked';

const FormattedArenaResponse = ({ text, responseTime, messageId }) => {
  // Function to process markdown and citations in Arena bot text
  const processCitations = (text) => {
    if (!text) return { processedText: '', citations: [] };

    // Configure marked options for better rendering
    marked.setOptions({
      breaks: true, // Convert line breaks to <br>
      gfm: true, // GitHub Flavored Markdown
    });

    // First, convert markdown to HTML
    let htmlText;
    try {
      htmlText = marked(text);
    } catch (error) {
      console.error('Error processing markdown:', error);
      htmlText = text; // Fallback to original text
    }

    const citations = [];
    const citationMap = new Map(); // Track unique citations and their numbers
    let citationCounter = 1;
    
    // Process citations with double brackets [[citation]]
    const processedText = htmlText.replace(/\[\[([^\]]+)\]\]/g, (match, citation) => {
      let citationNumber;
      let citationId;
      
      // Check if this citation already exists
      if (citationMap.has(citation)) {
        // Use existing number for repeated citation
        citationNumber = citationMap.get(citation);
        citationId = `arena${messageId}-ref${citationNumber}`;
      } else {
        // New citation - assign new number
        citationNumber = citationCounter;
        citationId = `arena${messageId}-ref${citationNumber}`;
        
        // Store in map and citations array
        citationMap.set(citation, citationNumber);
        citations.push({
          id: citationId,
          text: citation,
          number: citationNumber
        });
        
        citationCounter++;
      }
      
      const result = `<sup><a href="#${citationId}" class="citation-link" style="color: #4ade80; text-decoration: none; font-weight: 500;">${citationNumber}</a></sup>`;
      return result;
    });

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
