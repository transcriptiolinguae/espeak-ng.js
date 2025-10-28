  import initESpeak from './espeak-ng.js';

function normalizeCurlyApostrophes(text) {
  return text.replace(/[’‘]/g, "'");
}

  const outputElem = document.getElementById('output');
  const inputElem = document.getElementById('input');

  let wasmReady = false;

  window.addEventListener('load', async () => {
    try {
      await initESpeak({
        print: () => {},
        printErr: () => {}
      });
      wasmReady = true;
      console.log('eSpeak NG WASM loaded and ready');
    } catch (e) {
      console.error('Error loading WASM:', e);
      outputElem.classList.remove('placeholder');
      outputElem.innerText = 'Error loading eSpeak WASM module.';
    }
  });

  function printErrFiltered(err) {
    if (
      err.includes('still waiting on run dependencies') ||
      err.includes('dependency: wasm-instantiate') ||
      err.includes('(end of list)')
    ) {
      return;
    }
    console.error('eSpeak stderr:', err);
  }

  async function runESpeak(text) {
    let ipaOutput = '';
    await initESpeak({
      arguments: ['-v', 'it', '--ipa=3', text],
      print: (text) => {
        ipaOutput += text;
      },
      printErr: printErrFiltered
    });

    return ipaOutput
      .replace(/[\u0300-\u036F\u200B-\u200D\uFEFF]/g, '') 
      .replace(/rɾ/g, 'rː')
      .replace(/mm/g, 'mː')
      .replace(/ff/g, 'fː')
      .replace(/vv/g, 'vː')
      .replace(/ll/g, 'lː')
      .replace(/kk/g, 'kː')
      .replace(/nn/g, 'nː')
      .replace(/ɲɲ/g, 'ɲː')
      .replace(/oo/g, 'oː')      
      .replace(/ss/g, 'sː')
      .replace(/tt/g, 't')
      .replace(/dd/g, 'd')
      .replace(/ɾ/g, 'r')
      .replace(/ɪ/g, 'i')
      .replace(/ʊ/g, 'u')
      .replace(/ɡ/g, 'g')
      .trim();
  }

  function showPlaceholder() {
    outputElem.className = 'placeholder';
    outputElem.innerText = 'Trascrizione';
  }

  function showProgressPlaceholder() {
    outputElem.className = 'placeholder';
    outputElem.innerText = 'Trascrizione in corso...';
  }

  function setOutput(text) {
    outputElem.classList.remove('placeholder');
    outputElem.innerText = text;
  }

function splitTextByLength(text, maxLength = 500) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    let end = start + maxLength;

    if (end < text.length) {
      const lastSpace = text.lastIndexOf(' ', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }

    chunks.push(text.slice(start, end));
    start = end;
  }
  return chunks;
}

document.getElementById('convert').addEventListener('click', async () => {
  showProgressPlaceholder();

  if (!wasmReady) {
    alert('Please wait, WASM is still loading...');
    return;
  }

  const rawInput = inputElem.value.trim();
  if (!rawInput) {
    showPlaceholder();
    return;
  }

  try {
    const chunks = splitTextByLength(rawInput, 500);
    let finalResult = '';

    for (const chunk of chunks) {

      const tokens = chunk.match(
        /[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*|[0-9]+(?:[.,][0-9]+)?|[^\s]/gu
      );
      if (!tokens) {
        finalResult += chunk;
        continue;
      }

      const wordTokens = tokens.filter(t =>
        /^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u.test(t)
      );

      const markedInput = wordTokens.join('|');
      const ipaRaw = await runESpeak(markedInput);
      const ipaClean = ipaRaw.replace(/\|/g, ' ').trim();
      const ipaWords = ipaClean.split(/\s+/);

      const ipaMap = new Map();
      for (let i = 0; i < wordTokens.length; i++) {
        ipaMap.set(wordTokens[i], ipaWords[i] || '');
      }

      let reconstructed = '';
      let charIndex = 0;

      for (const token of tokens) {

        while (chunk[charIndex] && /\s/.test(chunk[charIndex])) {
          reconstructed += chunk[charIndex++];
        }

        const isWord = /^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u.test(token);
        if (isWord) {

          reconstructed += ipaMap.get(token) || token;
        } else {

          reconstructed += token;
        }

        charIndex += token.length;
      }

      finalResult += reconstructed;
    }

    setOutput(finalResult.trim() || '[No output generated]');
  } catch (e) {
    console.error('Error during AFI transcription:', e);
    setOutput('Error during AFI transcription: ' + e.message);
  }
});

document.getElementById('convertInline').addEventListener('click', async () => {
  showProgressPlaceholder();

  if (!wasmReady) {
    alert('Please wait, WASM is still loading...');
    return;
  }

  const rawInput = inputElem.value.trim();
  if (!rawInput) {
    showPlaceholder();
    return;
  }

  try {

    const normalized = rawInput.replace(/[’‘]/g, "'");

    const chunks = splitTextByLength(normalized, 500);
    let finalResult = '';
    let charIndex = 0;

    for (const chunk of chunks) {

      const tokens = chunk.match(/[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*|[0-9]+(?:[.,][0-9]+)?|[^\s]/gu);
      if (!tokens) {
        finalResult += chunk; 
        continue;
      }

      const wordTokens = tokens.filter(t => /^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u.test(t));
      const markedInput = wordTokens.join('|');

      const ipaRaw = await runESpeak(markedInput);
      const ipaClean = ipaRaw.replace(/\|/g, ' ').trim();
      const ipaWords = ipaClean.split(/\s+/);

      const ipaMap = new Map();
      for (let i = 0; i < wordTokens.length; i++) {
        ipaMap.set(wordTokens[i], ipaWords[i] || '');
      }

      let chunkResult = '';
      let idx = 0;
      for (const token of tokens) {
        while (chunk[idx] && /\s/.test(chunk[idx])) {
          chunkResult += chunk[idx++];
        }

        const originalToken = chunk.slice(idx, idx + token.length);
        idx += token.length;

        if (/^[\p{L}\p{M}]+(?:'[\p{L}\p{M}]+)*$/u.test(token)) {
          const ipa = ipaMap.get(token) || '';
          chunkResult += `${originalToken}${ipa ? ' (' + ipa + ')' : ''}`;
        } else {
          chunkResult += originalToken;
        }
      }

      while (rawInput[charIndex] && /\s/.test(rawInput[charIndex])) {
        chunkResult = rawInput[charIndex++] + chunkResult;
      }
      charIndex += chunk.length;

      finalResult += chunkResult;
    }

    setOutput(finalResult);
  } catch (e) {
    console.error('Error during IPA conversion:', e);
    setOutput('Error during IPA conversion: ' + e.message);
  }
});

document.getElementById('g2p').addEventListener('click', async () => {
  showProgressPlaceholder();

  if (!wasmReady) {
    alert('Please wait, WASM is still loading...');
    return;
  }

  const rawInput = normalizeCurlyApostrophes(inputElem.value.trim());
  if (!rawInput) {
    showPlaceholder();
    return;
  }

  try {
    const chunks = splitTextByLength(rawInput, 500);
    let finalResult = '';

    for (const chunk of chunks) {
      const tokens = chunk.match(
        /[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]+(?:'[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]+)*|[0-9]+(?:[.,][0-9]+)?|[^\s]/gu
      );
      if (!tokens) {
        finalResult += chunk;
        continue;
      }

      const uniqueWords = [...new Set(
        tokens.filter(t =>
          /^[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]+'?[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]*$/u.test(t)
        )
      )];

      const markedInput = uniqueWords.join('|');
      const ipaRaw = await runESpeak(markedInput);
      const ipaClean = ipaRaw.replace(/\|/g, ' ').trim();
      const ipaWords = ipaClean.split(/\s+/);

      const ipaMap = new Map();
      for (let i = 0; i < uniqueWords.length; i++) {
        ipaMap.set(uniqueWords[i], ipaWords[i] || '');
      }

      const g2pTokens = tokens.map(token => {
        const isWord = /^[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]+'?[A-Za-zÀ-ÖØ-öø-ÿĀ-žḀ-ỿ]*$/u.test(token);
        if (isWord) {
          const ipa = ipaMap.get(token) || '';
          return applyG2PMapping(token, ipa);
        } else {
          return token;
        }
      });

      let reconstructed = '';
      let index = 0;
      for (const token of tokens) {
        while (chunk[index] && /\s/.test(chunk[index])) {
          reconstructed += chunk[index++];
        }
        reconstructed += g2pTokens.shift();
        index += token.length;
      }

      finalResult += reconstructed;
    }

    setOutput(finalResult.trim());
  } catch (e) {
    console.error('Error during G2P processing:', e);
    setOutput('Error during G2P processing: ' + e.message);
  }
});

function applyG2PMapping(text, ipa) {

  const result = [];
  let ipaIndex = 0;
  let i = 0;
  const lowerText = text.toLowerCase();

  const g2pMappings = {
    "bb": "bː",
    "dd": "dː",
    "ff": "fː",
    "ll": "lː", 
    "mm": "mː",
    "nn": "nː",   
    "pp": "pː",
    "qq": "qq",  
    "rr": "rː",
    "ss": "sː",
    "tt": "tː",
    "vv": "vː", 
  };

  function startsWithIpa(ipa, pattern) {
    const variations = [`${pattern}`, `ˈ${pattern}`, `ˌ${pattern}`, `\u200D${pattern}`, `ˈ\u200D${pattern}`, `\u200Dˈ${pattern}`];
    for (const variant of variations) {
      if (ipa.startsWith(variant)) return { match: variant, len: variant.length };
    }
    return null;
  }

  function isFollowedByVowel(ipa, index) {
    const following = ipa.slice(index + 3); 
    return following.startsWith('i') || following.startsWith('ˈi') || following.startsWith('j') || following.startsWith('ˈj') ||
           following.startsWith('e') || following.startsWith('ˈe') || following.startsWith('ɛ') || following.startsWith('ˈɛ');
  }

  while (i < text.length && ipaIndex < ipa.length) {
    const letter = text[i];
    let ipaChar = ipa[ipaIndex];

        if (ipaChar === 'd' && ipa[ipaIndex + 1] === 'z' && ipa[ipaIndex + 2] === 'ː') {
        result.push(`zz(${ipaChar}${ipa[ipaIndex + 1]}ː)`);  
        i += 2;  
        ipaIndex += 3;  
        continue;

    } else if (ipaChar === 't' && ipa[ipaIndex + 1] === 's' && ipa[ipaIndex + 2] === 'ː') {
        result.push(`zz(${ipaChar}${ipa[ipaIndex + 1]}ː)`); 
        i += 2; 
        ipaIndex += 3; 
        continue;
      }

       if (lowerText[i] === 'i') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'i' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈi)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === 'a') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'a' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈa)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === 'e') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'e' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈe)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === 'e') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'ɛ' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈɛ)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === "'" && /[a-z\u00C0-\u017F]/i.test(lowerText[i + 1])) {

              const ipaRegex = /[a-z\u0250-\u02AF\u02B0-\u02FF\u0300-\u036F\u1D00-\u1DBF\uA700-\uA71F]/i;

      if (ipa[ipaIndex] === 'ˈ' && ipaRegex.test(ipa[ipaIndex]) && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i+1]}(ˈ${ipa[ipaIndex + 1]})`);
          i += 2; 
          ipaIndex += 3; 
          continue; 
        }}

          if (lowerText[i] === "'" && /[a-z]/i.test(lowerText[i + 1])) {

                 const ipaRegex = /[a-z\u0250-\u02AF\u02B0-\u02FF\u0300-\u036F\u1D00-\u1DBF\uA700-\uA71F]/i;

      if (ipa[ipaIndex] === 'ˈ' && ipaRegex.test(ipa[ipaIndex])) {
          result.push(`${text[i+1]}(ˈ${ipa[ipaIndex + 1]})`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
      }}

             if (lowerText[i] === "'" && /[a-z]/i.test(lowerText[i + 1])) {

                 const ipaRegex = /[a-z\u0250-\u02AF\u02B0-\u02FF\u0300-\u036F\u1D00-\u1DBF\uA700-\uA71F]/i;

      if (ipa[ipaIndex] === 'ˌ' && ipaRegex.test(ipa[ipaIndex])) {
          result.push(`${text[i+1]}(ˌ${ipa[ipaIndex + 1]})`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
      }}

              if (lowerText[i] === "'" && /[a-z\u00C0-\u017F]/i.test(lowerText[i + 1])) {

      const ipaRegex = /[a-z\u0250-\u02AF\u02B0-\u02FF\u0300-\u036F\u1D00-\u1DBF\uA700-\uA71F]/i;

      if (ipaRegex.test(ipa[ipaIndex])) {
          result.push(`'${text[i+1]}(${ipa[ipaIndex]})`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
      }}

       if (lowerText[i] === 'o') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'o' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈo)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === 'o') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'ɔ' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈɔ)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

       if (lowerText[i] === 'u') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'u' && ipa[ipaIndex + 2] === 'ː') {
          result.push(`${text[i]}(ˈu)`);
          i += 1; 
          ipaIndex += 3; 
          continue; 
        }
      }

        if (lowerText[i] === 'z') {

      if (ipa[ipaIndex] === 't' && ipa[ipaIndex + 1] === 's') {
        const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

        if (!/ː/.test(nextIpa)) { 

          result.push(`${letter}(ts)`);
          i += 1; 
          ipaIndex += 2; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'z') {

      if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'z') {
        const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

        if (!/ː/.test(nextIpa)) { 

          result.push(`${letter}(dz)`);
          i += 1; 
          ipaIndex += 2; 
          continue; 
        }
      }
    }

if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'ˈ' && ipa[ipaIndex + 3] === 'i') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

    } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'i') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

 } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'ˈ' && ipa[ipaIndex + 3] === 'j') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

    } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'j') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

                 } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'ˈ' && ipa[ipaIndex + 3] === 'e') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

    } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'e') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

                 } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'ˈ' && ipa[ipaIndex + 3] === 'ɛ') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;

    } else if (ipaChar === 'k' && ipa[ipaIndex + 1] === 'ː' && ipa[ipaIndex + 2] === 'ɛ') {
        result.push(`cch(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 3;  
        ipaIndex += 2;  
        continue;
          }     

        if (lowerText[i] === 'g' && lowerText[i + 1] === 'n') {

      if (ipa[ipaIndex] === 'ɲ') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (!/ː/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(ɲ)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }
    }           

    if (lowerText[i] === 'g' && lowerText[i + 1] === 'n') { 
    if (ipa[ipaIndex] === 'ɲ' && ipa[ipaIndex + 1] === 'ː') {
        result.push(`${letter}${text[i + 1]}(ɲː)`); 
        i += 2; 
        ipaIndex += 2; 
        continue; 
      }
    }

        if (lowerText[i] === 'g' && lowerText[i + 1] === 'l' && lowerText[i + 2] === 'i') {

      if (ipa[ipaIndex] === 'ʎ') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (/i|ˈi/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(ʎ)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }

else if (!/i|ˈi/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}${text[i + 2]}(ʎ)`);
          i += 3; 
          ipaIndex += 1; 
          continue; 

      }
    }
  }

    if (ipaChar === 't' && lowerText[i + 1] === 's') {
        result.push(`z(${ipaChar}${ipa[ipaIndex + 1]})`);  
        i += 1;  
        ipaIndex += 2;  
        continue;

    }

        if (lowerText[i] === 'c' && lowerText[i + 1] === 'c' && lowerText[i + 2] === 'i') {

      if (ipa[ipaIndex] === 't' && ipa[ipaIndex + 1] === 'ʃ' && ipa[ipaIndex + 2] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 3, ipaIndex + 5); 

        if (/ɔ|ˈɔ|o|ˈo|a|ˈa|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}${text[i + 2]}(tʃː)`);
          i += 3; 
          ipaIndex += 3; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'g' && lowerText[i + 1] === 'g' && lowerText[i + 2] === 'i') {

      if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'ʒ' && ipa[ipaIndex + 2] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 3, ipaIndex + 5); 

        if (!/i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}${text[i + 2]}(dʒː)`);
          i += 3; 
          ipaIndex += 3; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 's' && lowerText[i + 1] === 'c' && lowerText[i + 2] === 'i') {

      if (ipa[ipaIndex] === 'ʃ') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (!/i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}${text[i + 2]}(ʃ)`);
          i += 3; 
          ipaIndex += 1; 
          continue; 
        }
      }
    }

            if (lowerText[i] === 'c' && lowerText[i + 1] === 'c') {

      if (ipa[ipaIndex] === 't' && ipa[ipaIndex + 1] === 'ʃ' && ipa[ipaIndex + 2] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 3, ipaIndex + 5); 

        if (/e|ˈe|ɛ|ˈɛ|i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(tʃː)`);
          i += 2; 
          ipaIndex += 3; 
          continue; 
        }
      }
    }

            if (lowerText[i] === 'g' && lowerText[i + 1] === 'g') {

      if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'ʒ' && ipa[ipaIndex + 2] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 3, ipaIndex + 5); 

        if (/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(dʒː)`);
          i += 2; 
          ipaIndex += 3; 
          continue; 
        }
      }
    }

            if (lowerText[i] === 's' && lowerText[i + 1] === 'c' && lowerText[i + 2] === 'i') {

      if (ipa[ipaIndex] === 'ʃ') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (/i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(ʃ)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'c' && lowerText[i + 1] === 'i') {

      if (ipa[ipaIndex] === 't' && ipa[ipaIndex + 1] === 'ʃ') {
        const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

        if (!/i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(tʃ)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'c' && lowerText[i + 1] === 'h') {

      if (ipa[ipaIndex] === 'k') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(k)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'g' && lowerText[i + 1] === 'i') {

      if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'ʒ') {
        const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

        if (!/i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(dʒ)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'g' && lowerText[i + 1] === 'h') {

      if (ipa[ipaIndex] === 'g') {
        const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

        if (/e|ˈe|ɛ|ˈɛ|i|ˈi|j|ˈj/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(g)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }
    }

        if (lowerText[i] === 'h' && lowerText[i + 1] === 'a') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'a') {
          result.push(`${letter}${text[i + 1]}(ˈa)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

            if (lowerText[i] === 'h' && lowerText[i + 1] === 'a') {

      if (ipa[ipaIndex] === 'ˌ' && ipa[ipaIndex + 1] === 'a') {
          result.push(`${letter}${text[i + 1]}(ˌa)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

            if (lowerText[i] === 'h' && lowerText[i + 1] === 'o') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'o') {
          result.push(`${letter}${text[i + 1]}(ˈo)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

           if (lowerText[i] === 'h' && lowerText[i + 1] === 'a') {

      if (ipa[ipaIndex] === 'a') {
          result.push(`${letter}${text[i + 1]}(a)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

            if (lowerText[i] === 'h' && lowerText[i + 1] === 'ɔ') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'ɔ') {
          result.push(`${letter}${text[i + 1]}(ˈɔ)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

        if (lowerText[i] === "'" && lowerText[i + 1] === 'a') {

      if (ipa[ipaIndex] === 'a') {
          result.push(`${letter}${text[i + 1]}(a)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'e') {

      if (ipa[ipaIndex] === 'e') {
          result.push(`${letter}${text[i + 1]}(e)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

          if (lowerText[i] === "'" && lowerText[i + 1] === 'e') {

      if (ipa[ipaIndex] === 'ɛ') {
          result.push(`${letter}${text[i + 1]}(ɛ)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'o') {

      if (ipa[ipaIndex] === 'ɔ') {
          result.push(`${letter}${text[i + 1]}(ɔ)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'i') {

      if (ipa[ipaIndex] === 'i') {
          result.push(`${letter}${text[i + 1]}(i)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

                if (lowerText[i] === "'" && lowerText[i + 1] === 'u') {

      if (ipa[ipaIndex] === 'u') {
          result.push(`${letter}${text[i + 1]}(u)`);
          i += 2; 
          ipaIndex += 1; 
          continue; 
        }
      }

            if (lowerText[i] === "'" && lowerText[i + 1] === 'a') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'a') {
          result.push(`${letter}${text[i + 1]}(ˈa)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'e') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'e') {
          result.push(`${letter}${text[i + 1]}(ˈe)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

          if (lowerText[i] === "'" && lowerText[i + 1] === 'e') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'ɛ') {
          result.push(`${letter}${text[i + 1]}(ˈɛ)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'o') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'ɔ') {
          result.push(`${letter}${text[i + 1]}(ˈɔ)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

             if (lowerText[i] === "'" && lowerText[i + 1] === 'i') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'i') {
          result.push(`${letter}${text[i + 1]}(ˈi)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

                if (lowerText[i] === "'" && lowerText[i + 1] === 'u') {

      if (ipa[ipaIndex] === 'ˈ' && ipa[ipaIndex + 1] === 'u') {
          result.push(`${letter}${text[i + 1]}(ˈu)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

    if (lowerText[i] === 'c') { 
    if (ipa[ipaIndex] === 't' && ipa[ipaIndex + 1] === 'ʃ') {
      const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

      if (/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 
        result.push(`${letter}(tʃ)`); 
        i += 1; 
        ipaIndex += 2; 
        continue; 
      }
    }
 }

    if (lowerText[i] === 'g') { 
    if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'ʒ') {
      const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

      if (/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 
        result.push(`${letter}(dʒ)`); 
        i += 1; 
        ipaIndex += 2; 
        continue; 
      }
    }
 }

    if (lowerText[i] === 's' && lowerText[i + 1] === 'c') { 
    if (ipa[ipaIndex] === 'ʃ') {
      const nextIpa = ipa.slice(ipaIndex + 1, ipaIndex + 3); 

      if (/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 
        result.push(`${letter}${text[i + 1]}(ʃ)`); 
        i += 2; 
        ipaIndex += 1; 
        continue; 
      }
    }
 }

    if (lowerText[i] === 'c' && lowerText[i + 1] === 'c') {

      if (ipa[ipaIndex] === 'k' && ipa[ipaIndex + 1] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 2, ipaIndex + 4); 

        if (!/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(kː)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }
    }

    if (lowerText[i] === 'c' && lowerText[i + 1] === 'q') { 
    if (ipa[ipaIndex] === 'k' && ipa[ipaIndex + 1] === 'ː') {
        result.push(`${letter}${text[i + 1]}(kː)`); 
        i += 2; 
        ipaIndex += 2; 
        continue; 
      }
    }

                if (lowerText[i] === 'g' && lowerText[i + 1] === 'g') {

      if (ipa[ipaIndex] === 'd' && ipa[ipaIndex + 1] === 'ʒ' && ipa[ipaIndex + 2] === 'ː') {
        const nextIpa = ipa.slice(ipaIndex + 3, ipaIndex + 5); 

        if (!/i|ˈi|j|ˈj|e|ˈe|ɛ|ˈɛ/.test(nextIpa)) { 

          result.push(`${letter}${text[i + 1]}(gː)`);
          i += 2; 
          ipaIndex += 3; 
          continue; 
        }
      }
    }

                if (lowerText[i] === 'g' && lowerText[i + 1] === 'g') {

      if (ipa[ipaIndex] === 'g' && ipa[ipaIndex + 1] === 'ː') {
          result.push(`${letter}${text[i + 1]}(gː)`);
          i += 2; 
          ipaIndex += 2; 
          continue; 
        }
      }

    const mappedIpa = g2pMappings[lowerText.slice(i, i + 2)];
    if (mappedIpa) {
      result.push(`${text.slice(i, i + 2)}(${mappedIpa})`);
      i += 2;  
      ipaIndex += mappedIpa.length;  
      continue;
    }

    if (ipaChar === 'ˈ' || ipaChar === 'ˌ') {
      ipaIndex++;
      ipaChar = ipa[ipaIndex];
      result.push(`${letter}(ˈ${ipaChar})`);
    } else {
      result.push(`${letter}(${ipaChar})`);
    }

    ipaIndex++;
    i++;
  }

  while (i < text.length) {
    result.push(`${text[i]}()`);
    i++;
  }

  return result.join('');

}
