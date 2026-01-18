import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Switch } from 'wouter';
import HomePage from './pages/HomePage';
import SearchPage from './pages/SearchPage';
import AdvisorPage from './pages/AdvisorPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-slate-50">
        <Switch>
          <Route path="/" component={HomePage} />
          <Route path="/search" component={SearchPage} />
          <Route path="/advisor/:slug" component={AdvisorPage} />
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
