# MarIA Chat - Supabase Version

This is a refactored version of the MarIA chat application that uses Supabase for authentication instead of a custom backend. This version is optimized for deployment on Netlify.

## Features

- ✅ Supabase Authentication (Sign up, Sign in, Sign out)
- ✅ Real-time auth state management
- ✅ Email confirmation support
- ✅ Modern React with hooks
- ✅ Tailwind CSS styling
- ✅ Responsive design
- ✅ Ready for Netlify deployment

## Technologies Used

- **Frontend**: React 18, Vite
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS
- **Routing**: React Router DOM
- **HTTP Client**: Axios
- **Deployment**: Netlify

## Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   Create a `.env` file in the root directory with:
   ```
   VITE_SUPABASE_URL=https://bhpelimxagpohziqcufh.supabase.co
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. **Start the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to `http://localhost:5173`

## Deployment to Netlify

### Option 1: Drag & Drop (Easiest)

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Drag the `dist` folder** to Netlify's deploy area at [netlify.com/drop](https://app.netlify.com/drop)

### Option 2: Git Integration (Recommended)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - MarIA Supabase version"
   git branch -M main
   git remote add origin https://github.com/yourusername/maria-supabase.git
   git push -u origin main
   ```

2. **Connect to Netlify**:
   - Go to [Netlify](https://app.netlify.com)
   - Click "New site from Git"
   - Choose GitHub and select your repository
   - Set build settings:
     - **Build command**: `npm run build`
     - **Publish directory**: `dist`

3. **Set Environment Variables in Netlify**:
   - Go to Site settings > Environment variables
   - Add:
     - `VITE_SUPABASE_URL`: `https://bhpelimxagpohziqcufh.supabase.co`
     - `VITE_SUPABASE_ANON_KEY`: `your_supabase_anon_key`

4. **Deploy**: Netlify will automatically build and deploy your site

## Supabase Configuration

### Required Supabase Settings

1. **Authentication Settings**:
   - Go to Authentication > Settings in your Supabase dashboard
   - Enable email confirmations if desired
   - Set your site URL in "Site URL" (e.g., `https://your-site.netlify.app`)
   - Add your Netlify domain to "Additional redirect URLs"

2. **RLS (Row Level Security)**:
   - If you plan to store user data, ensure RLS is properly configured
   - For this chat app, authentication is handled entirely by Supabase Auth

## Project Structure

```
react-frontend-supabase/
├── public/
├── src/
│   ├── components/
│   │   ├── BotaoSair.jsx
│   │   ├── ChatMessage.jsx
│   │   └── FeedbackModal.jsx
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── PaginaChat.jsx
│   │   ├── PaginaLogin.jsx
│   │   └── PaginaRegisto.jsx
│   ├── services/
│   │   └── api.js
│   ├── App.jsx
│   ├── main.jsx
│   └── supabaseClient.js
├── netlify.toml
├── package.json
└── README.md
```

## Key Differences from Original

1. **Authentication**: Uses Supabase Auth instead of custom backend
2. **Real-time Auth**: Automatic auth state synchronization
3. **Email Confirmation**: Built-in support for email verification
4. **JWT Tokens**: Automatic token management via Supabase
5. **Deployment Ready**: Optimized for Netlify with proper redirects

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anonymous key | Yes |

## Troubleshooting

### Common Issues

1. **Authentication not working**:
   - Check that environment variables are set correctly
   - Verify Supabase URL and key are valid
   - Ensure site URL is configured in Supabase

2. **Build fails on Netlify**:
   - Check that all environment variables are set in Netlify
   - Verify Node.js version (should be 18+)

3. **Redirects not working**:
   - Ensure `netlify.toml` is in the root directory
   - Check that the redirect rule is properly configured

## Support

For issues related to:
- **Supabase**: Check [Supabase Documentation](https://supabase.com/docs)
- **Netlify**: Check [Netlify Documentation](https://docs.netlify.com)
- **React/Vite**: Check respective documentation

## License

This project is part of the MarIA health assistant application.
