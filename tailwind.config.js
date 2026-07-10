/** @type {import('tailwindcss').Config} */
export default {
    content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
    theme: {
        extend: {
            colors: {
                border: 'hsl(var(--border))',
                input: 'hsl(var(--input))',
                ring: 'hsl(var(--ring))',
                background: 'hsl(var(--background))',
                'content-background': 'hsl(var(--content-background))',
                'header-background': 'hsl(var(--header-background))',
                foreground: 'hsl(var(--foreground))',
                navbar: {
                    DEFAULT: 'hsl(var(--navbar))',
                    foreground: 'hsl(var(--navbar-foreground))',
                },
                primary: {
                    DEFAULT: 'hsl(var(--primary))',
                    foreground: 'hsl(var(--primary-foreground))',
                },
                secondary: {
                    DEFAULT: 'hsl(var(--secondary))',
                    foreground: 'hsl(var(--secondary-foreground))',
                },
                destructive: {
                    DEFAULT: 'hsl(var(--destructive))',
                    foreground: 'hsl(var(--destructive-foreground))',
                },
                muted: {
                    DEFAULT: 'hsl(var(--muted))',
                    foreground: 'hsl(var(--muted-foreground))',
                },
                accent: {
                    DEFAULT: 'hsl(var(--accent))',
                    foreground: 'hsl(var(--accent-foreground))',
                },
                popover: {
                    DEFAULT: 'hsl(var(--popover))',
                    foreground: 'hsl(var(--popover-foreground))',
                },
                card: {
                    DEFAULT: 'hsl(var(--card))',
                    foreground: 'hsl(var(--card-foreground))',
                },
                linkForeground: 'hsl(var(--link-foreground))',
            },
            keyframes: {
                'swipe-out-left': {
                    to: { transform: 'translateX(-40%) rotate(-12deg)', opacity: '0' },
                },
                'swipe-out-right': {
                    to: { transform: 'translateX(40%) rotate(12deg)', opacity: '0' },
                },
            },
            animation: {
                'swipe-out-left': 'swipe-out-left 0.3s ease-out forwards',
                'swipe-out-right': 'swipe-out-right 0.3s ease-out forwards',
            },
        },
    },
    plugins: [],
};
