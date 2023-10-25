var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const axios = require('axios');
require('dotenv').config();

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'hbs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);


const CLIENT_ID =  process.env.CLIENT_ID;
const CLIENT_SECRET =  process.env.CLIENT_SECRET;
const TMDB_API_KEY =  process.env.TMDB_API_KEY;

//access token from spotify web api documentation
async function getAccessToken() {
  const response = await axios({
    method: 'post',
    url: 'https://accounts.spotify.com/api/token',
    params: {
      grant_type: 'client_credentials',
    },
    headers: {
      Authorization: `Basic ${Buffer.from(
        `${CLIENT_ID}:${CLIENT_SECRET}`
      ).toString('base64')}`,
    },
  });
  return response.data.access_token;
}

//album fetcher using token 
async function getAlbum(searchQuery) {
  const accessToken = await getAccessToken();
  const response = await axios.get('https://api.spotify.com/v1/search', {
    params: {
      q: searchQuery,
      type: 'album',
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return response.data.albums.items[0]; //get the first album
}

app.get('/tmdb/search-movies', async (req, res) => {
  const query = req.query.q;
  const page = req.query.page || 1; //searches for page number, has it set to one by default

  //searching for movies using the TMDB API 
  const response = await axios.get('https://api.themoviedb.org/3/search/movie', {
    params: {
      api_key: TMDB_API_KEY,
      query: query,
      page: page,
    },
  });
  const movies = response.data.results;
  res.render('search-results', { title: "Soundtracker - Search Movies", movies: movies});
});


app.get('/movie-details/:tmdbId', async (req, res, next) => {
  try {
    const tmdbId = req.params.tmdbId;
    // fetch movie details
    const movieDetailsResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}`, {
      params: {
        api_key: TMDB_API_KEY,
      },
    });
    const movieDetails = movieDetailsResponse.data;
    // fetching the soundtrack album searching the movie's title and filtering by year of release
    const movieTitle = movieDetails.title;
    const movieYear = movieDetails.release_date.split('-')[0]; //seperating year from date
    const spotifySearchQuery = `year:${movieYear} ${movieTitle} `; //creating query with year and title
    const soundtrackAlbum = await getAlbum(spotifySearchQuery); //fetching album

    // fetching the recommended movies
    const recommendedMoviesResponse = await axios.get(`https://api.themoviedb.org/3/movie/${tmdbId}/recommendations`, {
      params: {
        api_key: TMDB_API_KEY,
      },
    });
    const totalrecMovies = recommendedMoviesResponse.data.results;
    const recommendedMovies = totalrecMovies.slice(0, 5); //limiting to only 5 reccomendations for ease of loading 

    const recommendedMoviesWithSoundtracks = []; //creating array for recomendations

    //for loop to find corresponding soundtrack album 
    for (const movie of recommendedMovies) { 
      recommendedMoviesWithSoundtracks.push({ 
        ...movie,
      });
    }
    res.render('movie-details', {title: movieTitle, movieDetails, soundtrackAlbum, recommendedMovies: recommendedMoviesWithSoundtracks });
  } catch (error) {
    console.error(error);
    res.status(error.status || 500);
    next(createError(404));
    }
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;
