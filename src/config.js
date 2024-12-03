const INPUT_SAMPLE_RATE = 8000;
const OUTPUT_SAMPLE_RATE = 8000;

const CONFIG = {
    type: "SettingsConfiguration",
    audio: {
        input: {
            encoding: "mulaw",
            sample_rate: INPUT_SAMPLE_RATE
        },
        output: {
            encoding: "mulaw",
            sample_rate: OUTPUT_SAMPLE_RATE,
            container: "none",
        }
    },
    agent: {
        listen: {
            model: "nova-2"
        },
        think: {
            provider: {
                type: "open_ai"
            },
            model: "gpt-4o-mini",
            instructions: "You are a helpful assistant."
        },
        speak: {
            model: "aura-asteria-en"
        }
    }
}

export { CONFIG };