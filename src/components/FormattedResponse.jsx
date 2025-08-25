import React from 'react';

const FormattedResponse = ({ text }) => {
  if (!text) {
    return null;
  }

  // This function converts our simple markdown into HTML with the correct classes
  const processTextToHtml = (inputText) => {
    // Escape HTML to prevent injection, except for our specific tags
    const escapeHtml = (unsafe) => {
        return unsafe
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    };

    let safeText = escapeHtml(inputText);

    // 1. Handle citations (e.g., "text¹")
    safeText = safeText.replace(/(\s?)(\u00b9|\u00b2|\u00b3|[\u2074-\u2079])/g, (match, space, sup) => {
      const supMap = {
        '\u00b9': '1', '\u00b2': '2', '\u00b3': '3', '\u2074': '4',
        '\u2075': '5', '\u2076': '6', '\u2077': '7', '\u2078': '8', '\u2079': '9'
      };
      const num = supMap[sup] || sup;
      return `${space}<sup class="text-green-400 font-bold text-xs">${num}</sup>`;
    });

    // 2. Handle bolding: **text**
    safeText = safeText.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-white">$1</strong>');
    
    // 3. Handle list items: * item (and preserve list structure)
    safeText = safeText.split('\n').map(line => {
      if (line.trim().startsWith('* ')) {
        return `<li class="ml-4 list-disc">${line.trim().substring(2)}</li>`;
      }
      return line;
    }).join('\n'); // Join with \n to preserve paragraphs

    // 4. Handle paragraphs (convert newline characters to <br />)
    safeText = safeText.replace(/\n/g, '<br />');

    // Wrap list items in <ul>
    safeText = safeText.replace(/(<li.*<\/li>)/gs, '<ul>$1</ul>');
    
    return safeText;
  };

  return (
    <div 
      className="prose prose-sm prose-invert max-w-none text-gray-300"
      dangerouslySetInnerHTML={{ __html: processTextToHtml(text) }} 
    />
  );
};

export default FormattedResponse;