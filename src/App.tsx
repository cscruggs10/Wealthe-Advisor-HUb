import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import AdvisorPage from './pages/AdvisorPage';
import BlogPage from './pages/BlogPage';
import BlogPostPage from './pages/BlogPostPage';
import SpecialtyHubPage from './pages/SpecialtyHubPage';
import CityHubPage from './pages/CityHubPage';
import GoldenPage from './pages/GoldenPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/advisor/:slug" component={AdvisorPage} />
          <Route path="/blog" component={BlogPage} />
          <Route path="/blog/:slug" component={BlogPostPage} />
          {/* pSEO Hub Pages */}
          <Route path="/directory/location/:city" component={CityHubPage} />
          <Route path="/directory/:specialty/:city" component={GoldenPage} />
          <Route path="/directory/:specialty" component={SpecialtyHubPage} />
          <Route>
            <div className="flex items-center justify-center min-h-screen">
              <h1 className="text-2xl text-slate-600">Page not found</h1>
            </div>
          </Route>
        </Switch>
      </div>
    </QueryClientProvider>
  );
}

export default App;
